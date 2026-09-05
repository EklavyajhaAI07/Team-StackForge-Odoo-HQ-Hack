// Portal domain service. Everything here is reachable by a customer, so each function
// re-checks that the session's quotation matches the record it is about to touch.
import { prisma, type Tx } from "@/lib/db";
import { ApiError } from "@/lib/api";
import { getPortalSession, type PortalSession } from "@/lib/portal-auth";
import { quotationTotals } from "@/lib/quotes";
import type { QuotationDetail } from "./quotation";
import { displayCurrency } from "@/lib/money";

type Db = Tx | typeof prisma;

/** The customer's session, or a 401. Never consults the internal realm. */
export async function requirePortalSession(quotationId?: string): Promise<PortalSession> {
  const session = await getPortalSession();
  if (!session) throw new ApiError(401, "Open the quotation link again to continue");
  if (quotationId && session.quotationId !== quotationId) {
    throw new ApiError(403, "That quotation is not the one this link opens");
  }
  return session;
}

/** Statuses where the customer may still comment, counter or confirm. */
export const PORTAL_OPEN_STATUSES = ["SENT", "UNDER_NEGOTIATION", "PENDING_MANAGER", "PENDING_FINANCE", "APPROVED"];

export function assertPortalOpen(status: string): void {
  if (status === "CONFIRMED") throw new ApiError(409, "This quotation is already confirmed");
  if (status === "REJECTED") throw new ApiError(409, "This quotation is no longer available");
  if (!PORTAL_OPEN_STATUSES.includes(status)) {
    throw new ApiError(409, "This quotation is not open for changes right now");
  }
}

/** True while the customer's requested terms are still with the internal approvals team. */
export function awaitingInternalApproval(status: string): boolean {
  return status === "PENDING_MANAGER" || status === "PENDING_FINANCE";
}

export type PortalLineView = {
  id: string;
  name: string;
  description: string;
  unit: string;
  variantValue: string | null;
  planName: string | null;
  qty: number;
  unitPrice: number;
  discountPct: number;
  lineTotal: number;
  /** The customer's own pending counter on this line, if any. */
  counterPct: number | null;
  messages: { id: string; authorType: string; body: string; counterDiscountPct: number | null; createdAt: string }[];
};

/**
 * The customer-facing projection. Cost, margin, risk score, ceilings, rep identity beyond a
 * display name, audit events and every other internal figure are deliberately absent.
 */
export function toPortalView(q: QuotationDetail) {
  const totals = quotationTotals(q.lines);
  const lines: PortalLineView[] = q.lines.map((l) => {
    const messages = q.messages.filter((m) => m.lineId === l.id);
    const lastCustomerCounter = [...messages].reverse().find((m) => m.authorType === "CUSTOMER" && m.counterDiscountPct != null);
    const answered =
      lastCustomerCounter && messages.some((m) => m.authorType === "REP" && m.createdAt > lastCustomerCounter.createdAt);
    return {
      id: l.id,
      name: l.product.name,
      description: l.product.description,
      unit: l.product.unit,
      variantValue: l.variant?.value ?? null,
      planName: l.plan?.name ?? null,
      qty: l.qty,
      unitPrice: l.unitPrice,
      discountPct: l.discountPct,
      lineTotal: Math.round(l.qty * l.unitPrice * (1 - l.discountPct / 100)),
      counterPct: !answered && lastCustomerCounter ? (lastCustomerCounter.counterDiscountPct ?? null) : null,
      messages: messages.map((m) => ({
        id: m.id,
        authorType: m.authorType,
        body: m.body,
        counterDiscountPct: m.counterDiscountPct,
        createdAt: m.createdAt.toISOString(),
      })),
    };
  });

  return {
    id: q.id,
    number: q.number,
    status: q.status,
    company: q.customer.company,
    contact: q.customer.name,
    repName: q.rep.name,
    createdAt: q.createdAt.toISOString(),
    // The customer reads their own document in their own currency, at the rate this
    // quotation snapshotted — never a rate that has moved since it was sent.
    currency: displayCurrency(q.currency, q.fxRate),
    lines,
    totals,
    generalMessages: q.messages
      .filter((m) => !m.lineId)
      .map((m) => ({
        id: m.id,
        authorType: m.authorType,
        body: m.body,
        counterDiscountPct: m.counterDiscountPct,
        createdAt: m.createdAt.toISOString(),
      })),
  };
}

export type PortalView = ReturnType<typeof toPortalView>;

/** Load the quotation for a portal session and project it. */
export async function loadPortalQuotation(db: Db, quotationId: string) {
  const q = await db.quotation.findUnique({
    where: { id: quotationId },
    include: {
      customer: true,
      currency: true,
      rep: { select: { id: true, name: true, email: true } },
      lines: {
        include: { product: { include: { category: true, variants: true } }, variant: true, plan: true },
        orderBy: { id: "asc" },
      },
      approvals: { include: { approver: { select: { id: true, name: true } } }, orderBy: { step: "asc" } },
      messages: { orderBy: { createdAt: "asc" } },
      order: true,
      portalTokens: { orderBy: { expiresAt: "desc" } },
    },
  });
  if (!q) throw new ApiError(404, "Quotation not found");
  return q;
}
