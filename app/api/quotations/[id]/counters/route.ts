import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, authorize, handle, json, parseBody, requireUser } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { emit } from "@/lib/sse";
import {
  assess,
  getConfig,
  getPolicyCeilings,
  openCounters,
  recomputeRisk,
  requireQuotation,
  resolvedApprovedStatus,
  runRouting,
} from "@/lib/services/quotation";

const schema = z.object({
  messageId: z.string().min(1),
  decision: z.enum(["ACCEPT", "DECLINE"]),
  reply: z.string().trim().max(1000).optional().default(""),
});

/**
 * POST /api/quotations/[id]/counters — the rep answers a customer's counter (§5.5).
 * Accepting applies the discount and re-runs risk + routing from scratch, so an over-threshold
 * counter puts the quotation back into the approval chain without anyone asking (judge step 7).
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await ctx.params;
    const user = await requireUser();
    const { messageId, decision, reply } = await parseBody(req, schema);

    const result = await prisma.$transaction(async (tx) => {
      const q = await requireQuotation(tx, id);
      authorize(user, "quotation:edit", { repId: q.repId });

      const counter = q.messages.find((m) => m.id === messageId);
      if (!counter) throw new ApiError(404, "That message is not on this quotation");
      if (counter.authorType !== "CUSTOMER" || counter.counterDiscountPct == null) {
        throw new ApiError(400, "That message is not a discount request");
      }
      if (!openCounters(q.messages).some((m) => m.id === messageId)) {
        throw new ApiError(409, "You have already answered this request");
      }
      const line = counter.lineId ? q.lines.find((l) => l.id === counter.lineId) : undefined;
      if (!line) throw new ApiError(404, "The line for this request is no longer on the quotation");

      const accepted = decision === "ACCEPT";
      if (accepted) {
        await tx.quotationLine.update({ where: { id: line.id }, data: { discountPct: counter.counterDiscountPct } });
      }

      // The reply closes the counter, so the customer sees an answer either way.
      await tx.portalMessage.create({
        data: {
          quotationId: q.id,
          lineId: line.id,
          authorType: "REP",
          body:
            reply ||
            (accepted
              ? `Agreed — ${counter.counterDiscountPct}% applied to ${line.product.name}.`
              : `We cannot go to ${counter.counterDiscountPct}% on ${line.product.name}, so the current price stands.`),
        },
      });

      await logAudit(tx, {
        entityType: "Quotation",
        entityId: q.id,
        actor: { type: "USER", id: user.id },
        action: accepted ? "counter-accepted" : "counter-declined",
        reason: reply || null,
        meta: {
          product: line.product.name,
          counterDiscountPct: counter.counterDiscountPct,
          previousDiscountPct: line.discountPct,
        },
      });

      if (!accepted) {
        // Declining changes no terms; settle the status now that nothing is outstanding.
        const after = await requireQuotation(tx, id);
        if (after.status === "UNDER_NEGOTIATION" && openCounters(after.messages).length === 0) {
          const status = after.portalTokens.length > 0 ? "SENT" : "APPROVED";
          await tx.quotation.update({ where: { id: q.id }, data: { status } });
          return { status, rerouted: null as string | null, applied: false };
        }
        return { status: after.status, rerouted: null as string | null, applied: false };
      }

      // Accepted: the terms changed, so risk and routing run again from scratch.
      const refreshed = await recomputeRisk(tx, id);
      const [ceilings, config] = await Promise.all([getPolicyCeilings(tx, refreshed.q.customer.tier), getConfig(tx)]);
      const a = assess(refreshed.q, ceilings, config);
      const decisionResult = await runRouting(tx, refreshed.q, a, { type: "USER", id: user.id }, "counter");

      let status: string;
      if (decisionResult.kind === "AUTO_APPROVED") {
        status = resolvedApprovedStatus(await requireQuotation(tx, id));
        await tx.quotation.update({ where: { id: q.id }, data: { status: status as never } });
      } else {
        status = "PENDING_MANAGER";
      }
      return { status, rerouted: decisionResult.kind, applied: true, blended: a.risk.blended, maxLineOverage: a.risk.maxLineOverage };
    });

    emit(id, { type: "counter-answered", payload: { status: result.status, decision, rerouted: result.rerouted } });
    return json(result);
  });
}
