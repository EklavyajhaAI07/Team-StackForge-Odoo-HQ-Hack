import { prisma } from "@/lib/db";
import { ApiError, authorize, handle, json, requireUser } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { emit } from "@/lib/sse";
import { requireQuotation } from "@/lib/services/quotation";

/** POST /api/quotations/[id]/revise — reopen a rejected quotation as a draft. */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await ctx.params;
    const user = await requireUser();
    await prisma.$transaction(async (tx) => {
      const q = await requireQuotation(tx, id);
      authorize(user, "quotation:edit", { repId: q.repId });
      if (q.status !== "REJECTED") throw new ApiError(409, "Only a rejected quotation can be reopened");
      await tx.approval.deleteMany({ where: { quotationId: q.id } });
      await tx.quotation.update({ where: { id: q.id }, data: { status: "DRAFT" } });
      await logAudit(tx, { entityType: "Quotation", entityId: q.id, actor: { type: "USER", id: user.id }, action: "reopened", meta: { from: "REJECTED" } });
    });
    emit(id, { type: "status-changed", payload: { status: "DRAFT" } });
    return json({ ok: true, status: "DRAFT" });
  });
}
