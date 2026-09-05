// Quotation domain service: resolves DB rows into engine inputs, runs the pure engines,
// persists outcomes and writes audit events. Route handlers stay thin.
import type { Prisma, QuoteStatus, Tier } from "@prisma/client";
import { prisma, type Tx } from "@/lib/db";
import { computeRisk, type RiskLineInput, type RiskResult } from "@/lib/engine/risk";
import { routeQuotation, type RoutingDecision, type RoutingConfig } from "@/lib/engine/routing";
import { quotationTotals, type Totals } from "@/lib/quotes";
import { logAudit, type AuditActor } from "@/lib/audit";
import { ApiError } from "@/lib/api";
import { QUOTE_STATUS } from "@/components/ui/Pill";

type Db = Tx | typeof prisma;

export const quotationDetailInclude = {
  customer: true,
  rep: { select: { id: true, name: true, email: true } },
  lines: {
    include: {
      product: { include: { category: true, variants: true } },
      variant: true,
      plan: true,
    },
    orderBy: { id: "asc" },
  },
  approvals: { include: { approver: { select: { id: true, name: true } } }, orderBy: { step: "asc" } },
  messages: { orderBy: { createdAt: "asc" } },
  order: true,
  portalTokens: { orderBy: { expiresAt: "desc" } },
} satisfies Prisma.QuotationInclude;

export type QuotationDetail = Prisma.QuotationGetPayload<{ include: typeof quotationDetailInclude }>;

export const EDITABLE_STATUSES: QuoteStatus[] = ["DRAFT", "APPROVED", "SENT", "UNDER_NEGOTIATION"];
/** Statuses where a line edit must re-run routing from scratch (§5.2). */
export const REROUTE_ON_EDIT: QuoteStatus[] = ["APPROVED", "SENT", "UNDER_NEGOTIATION"];

export async function getQuotationDetail(db: Db, id: string): Promise<QuotationDetail | null> {
  return db.quotation.findUnique({ where: { id }, include: quotationDetailInclude });
}

export async function requireQuotation(db: Db, id: string): Promise<QuotationDetail> {
  const q = await getQuotationDetail(db, id);
  if (!q) throw new ApiError(404, "Quotation not found");
  return q;
}

export function assertEditable(q: QuotationDetail): void {
  if (!EDITABLE_STATUSES.includes(q.status)) {
    const label = QUOTE_STATUS[q.status]?.label.toLowerCase() ?? q.status;
    throw new ApiError(409, `Lines can't change while the quotation is ${label}`);
  }
}

export async function getPolicyCeilings(db: Db, tier: Tier): Promise<Map<string, number>> {
  const rows = await db.discountPolicy.findMany({ where: { tier } });
  return new Map(rows.map((r) => [r.categoryId, r.ceilingPct]));
}

export async function getTierPrices(db: Db, tier: Tier): Promise<Map<string, number>> {
  const rows = await db.priceListItem.findMany({ where: { tier } });
  return new Map(rows.map((r) => [r.productId, r.price]));
}

export async function getConfig(db: Db): Promise<RoutingConfig & { stalledDays: number; anomalySigma: number }> {
  const row = (await db.approvalConfig.findUnique({ where: { id: 1 } })) ?? (await db.approvalConfig.create({ data: { id: 1 } }));
  return row;
}

/** Engine inputs for a quotation. The stored unitPrice is the effective list price captured when the line was added. */
export function riskInputs(q: QuotationDetail, ceilings: Map<string, number>): RiskLineInput[] {
  return q.lines.map((l) => ({
    lineId: l.id,
    name: l.product.name,
    qty: l.qty,
    discountPct: l.discountPct,
    effectiveList: l.unitPrice,
    cost: l.product.cost,
    // DECISION: a missing policy row means "no discount allowed" — safer than silently allowing anything.
    ceilingPct: ceilings.get(l.product.categoryId) ?? 0,
  }));
}

export type Assessment = { risk: RiskResult; totals: Totals; decision: RoutingDecision };

export function assess(q: QuotationDetail, ceilings: Map<string, number>, config: RoutingConfig): Assessment {
  const risk = computeRisk(riskInputs(q, ceilings));
  const totals = quotationTotals(q.lines);
  const decision = routeQuotation({ blended: risk.blended, maxLineOverage: risk.maxLineOverage, total: totals.net }, config);
  return { risk, totals, decision };
}

/** Recompute + persist blendedRiskScore / maxLineOverage. */
export async function recomputeRisk(tx: Db, quotationId: string) {
  const q = await requireQuotation(tx, quotationId);
  const [ceilings, config] = await Promise.all([getPolicyCeilings(tx, q.customer.tier), getConfig(tx)]);
  const a = assess(q, ceilings, config);
  await tx.quotation.update({
    where: { id: q.id },
    data: { blendedRiskScore: a.risk.blended, maxLineOverage: a.risk.maxLineOverage },
  });
  return { q, config, ceilings, ...a };
}

/** Customer counters that the rep has not yet answered (a REP message on the same line, later). */
export function openCounters(messages: QuotationDetail["messages"]) {
  return messages.filter(
    (m) =>
      m.authorType === "CUSTOMER" &&
      m.counterDiscountPct != null &&
      !messages.some((r) => r.authorType === "REP" && r.lineId === m.lineId && r.createdAt > m.createdAt),
  );
}

/** Status once every approval step is satisfied: back to where the customer conversation was. */
export function resolvedApprovedStatus(q: QuotationDetail): QuoteStatus {
  if (openCounters(q.messages).length > 0) return "UNDER_NEGOTIATION";
  if (q.portalTokens.length > 0) return "SENT";
  return "APPROVED";
}

/**
 * §5.2 — runs routing from scratch: voids any existing approvals, creates the required steps,
 * sets the status and audits the decision. `trigger` explains why (initial submit, an edit, or an
 * accepted customer counter).
 */
export async function runRouting(
  tx: Db,
  q: QuotationDetail,
  a: Assessment,
  actor: AuditActor,
  trigger: "submit" | "edit" | "counter",
): Promise<RoutingDecision> {
  const { risk, totals, decision } = a;
  const existing = q.approvals;
  if (existing.length) await tx.approval.deleteMany({ where: { quotationId: q.id } });
  const voided = existing.map((ap) => ({ step: ap.step, role: ap.role, status: ap.status, approver: ap.approver?.name ?? null }));
  const base = { blended: risk.blended, maxLineOverage: risk.maxLineOverage, total: totals.net, trigger };

  if (decision.kind === "AUTO_APPROVED") {
    const status: QuoteStatus = trigger === "submit" ? "APPROVED" : resolvedApprovedStatus(q);
    await tx.quotation.update({ where: { id: q.id }, data: { status } });
    await logAudit(tx, {
      entityType: "Quotation",
      entityId: q.id,
      actor: { type: "SYSTEM" },
      action: "auto-approved: within policy",
      meta: { ...base, voided: voided.length ? voided : undefined },
    });
    return decision;
  }

  for (const [i, role] of decision.steps.entries()) {
    await tx.approval.create({ data: { quotationId: q.id, step: i + 1, role, status: "PENDING" } });
  }
  await tx.quotation.update({ where: { id: q.id }, data: { status: "PENDING_MANAGER" } });
  await logAudit(tx, {
    entityType: "Quotation",
    entityId: q.id,
    actor,
    action: trigger === "submit" ? "sent-for-approval" : "re-entered approval: terms changed",
    meta: { ...base, steps: decision.steps, reason: decision.reason, voided: voided.length ? voided : undefined },
  });
  return decision;
}

/**
 * Call after any line mutation: recompute risk, audit the change, and — if the quotation had
 * already cleared approval — re-run routing so changed terms never ride on stale approvals.
 */
export async function afterLinesChanged(
  tx: Db,
  quotationId: string,
  actor: AuditActor,
  change: { action: string; meta?: Record<string, unknown> },
) {
  const r = await recomputeRisk(tx, quotationId);
  await logAudit(tx, {
    entityType: "Quotation",
    entityId: quotationId,
    actor,
    action: change.action,
    meta: { ...(change.meta ?? {}), blended: r.risk.blended, maxLineOverage: r.risk.maxLineOverage } as Prisma.InputJsonValue,
  });
  let decision: RoutingDecision | null = null;
  if (REROUTE_ON_EDIT.includes(r.q.status)) {
    decision = await runRouting(tx, r.q, r, actor, "edit");
  }
  const status = (await tx.quotation.findUnique({ where: { id: quotationId }, select: { status: true } }))!.status;
  return { ...r, decision, status };
}
