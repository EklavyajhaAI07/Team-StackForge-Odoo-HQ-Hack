import { z } from "zod";
import type { QuoteStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ApiError, authorize, handle, json, parseBody, requireUser } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { emit } from "@/lib/sse";
import { requireQuotation, resolvedApprovedStatus } from "@/lib/services/quotation";

const schema = z.object({
  decision: z.enum(["APPROVE", "REJECT", "RETURN"]),
  reason: z.string().trim().max(500).optional().default(""),
});

/** POST /api/quotations/[id]/approve — act on the current pending step. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await ctx.params;
    const user = await requireUser();
    const { decision, reason } = await parseBody(req, schema);
    if (decision !== "APPROVE" && reason.length < 3) {
      throw new ApiError(400, decision === "REJECT" ? "Give a reason for rejecting" : "Say what needs to change before returning it");
    }

    const result = await prisma.$transaction(async (tx) => {
      const q = await requireQuotation(tx, id);
      if (q.status !== "PENDING_MANAGER" && q.status !== "PENDING_FINANCE") {
        throw new ApiError(409, "This quotation is not waiting for approval");
      }
      const step = q.approvals.find((a) => a.status === "PENDING");
      if (!step) throw new ApiError(409, "No pending approval step");
      authorize(user, step.role === "FINANCE" ? "approval:finance" : "approval:manager");
      if (q.repId === user.id) throw new ApiError(403, "You can't approve your own quotation");

      const now = new Date();
      let status: QuoteStatus;
      let action: string;

      if (decision === "APPROVE") {
        await tx.approval.update({ where: { id: step.id }, data: { status: "APPROVED", approverId: user.id, reason: reason || null, actedAt: now } });
        const next = q.approvals.find((a) => a.status === "PENDING" && a.step > step.step);
        status = next ? "PENDING_FINANCE" : resolvedApprovedStatus(q);
        action = "approved";
      } else if (decision === "REJECT") {
        await tx.approval.update({ where: { id: step.id }, data: { status: "REJECTED", approverId: user.id, reason, actedAt: now } });
        status = "REJECTED";
        action = "rejected";
      } else {
        await tx.approval.update({ where: { id: step.id }, data: { status: "RETURNED", approverId: user.id, reason, actedAt: now } });
        status = "DRAFT";
        action = "returned";
      }

      await tx.quotation.update({ where: { id: q.id }, data: { status } });
      await logAudit(tx, {
        entityType: "Quotation",
        entityId: q.id,
        actor: { type: "USER", id: user.id },
        action,
        reason: reason || null,
        meta: { step: step.step, role: step.role, resultingStatus: status },
      });
      return { status, step: step.step, role: step.role };
    });

    emit(id, { type: "status-changed", payload: { status: result.status, decision } });
    return json(result);
  });
}
