import { prisma } from "@/lib/db";
import { ApiError, handle, json } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { emit } from "@/lib/sse";
import { confirmQuotation } from "@/lib/services/order";
import { awaitingInternalApproval, requirePortalSession } from "@/lib/services/portal";

/**
 * POST /api/portal/confirm — the customer accepts the quotation (§5.5).
 * If the terms they asked for are still with the approvals team, confirmation is blocked
 * and they are told so; otherwise the order is created and the page fires its one confetti burst.
 */
export async function POST() {
  return handle(async () => {
    const session = await requirePortalSession();

    const result = await prisma.$transaction(async (tx) => {
      const q = await tx.quotation.findUnique({
        where: { id: session.quotationId },
        include: { lines: true, messages: true },
      });
      if (!q) throw new ApiError(404, "Quotation not found");
      if (q.customerId !== session.customerId) throw new ApiError(403, "That quotation belongs to another customer");
      if (q.status === "CONFIRMED") return { blocked: false as const, alreadyConfirmed: true, status: q.status };
      if (q.status === "REJECTED") throw new ApiError(409, "This quotation is no longer available");

      if (awaitingInternalApproval(q.status)) {
        await logAudit(tx, {
          entityType: "Quotation",
          entityId: q.id,
          actor: { type: "CUSTOMER", id: q.customerId },
          action: "confirm-blocked",
          meta: { status: q.status },
        });
        return { blocked: true as const, status: q.status };
      }

      // An unanswered counter must be settled by the rep before the customer can lock the terms in.
      const openCounter = q.messages.some(
        (m) =>
          m.authorType === "CUSTOMER" &&
          m.counterDiscountPct != null &&
          !q.messages.some((r) => r.authorType === "REP" && r.lineId === m.lineId && r.createdAt > m.createdAt),
      );
      if (openCounter) {
        await logAudit(tx, {
          entityType: "Quotation",
          entityId: q.id,
          actor: { type: "CUSTOMER", id: q.customerId },
          action: "confirm-blocked",
          meta: { status: q.status, message: "a requested change is still open" },
        });
        return { blocked: true as const, status: q.status };
      }

      const confirmed = await confirmQuotation(tx, q.id, { type: "CUSTOMER", id: q.customerId }, { via: "portal" });
      return { blocked: false as const, alreadyConfirmed: !confirmed.created, status: "CONFIRMED" as const, orderId: confirmed.order.id };
    });

    emit(session.quotationId, {
      type: result.blocked ? "confirm-blocked" : "status-changed",
      payload: { status: result.status },
    });

    if (result.blocked) {
      return json(
        {
          confirmed: false,
          status: result.status,
          message: "Your requested terms are with our approvals team. We will come back to you shortly.",
        },
        { status: 409 },
      );
    }
    return json({ confirmed: true, status: result.status, alreadyConfirmed: result.alreadyConfirmed ?? false });
  });
}
