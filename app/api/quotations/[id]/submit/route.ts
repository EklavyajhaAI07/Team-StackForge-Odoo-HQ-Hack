import { prisma } from "@/lib/db";
import { ApiError, authorize, handle, json, requireUser } from "@/lib/api";
import { emit } from "@/lib/sse";
import { recomputeRisk, requireQuotation, runRouting } from "@/lib/services/quotation";

/**
 * POST /api/quotations/[id]/submit — the contextual primary action on a DRAFT.
 * The rep never picks an approver: routing (§5.2) decides between auto-approval,
 * manager only, or manager + finance, from ApprovalConfig thresholds.
 */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await ctx.params;
    const user = await requireUser();

    const result = await prisma.$transaction(async (tx) => {
      const q = await requireQuotation(tx, id);
      authorize(user, "quotation:send", { repId: q.repId });
      if (q.status !== "DRAFT") throw new ApiError(409, "Only a draft can be submitted");
      if (q.lines.length === 0) throw new ApiError(400, "Add at least one line before submitting");
      const r = await recomputeRisk(tx, q.id);
      const decision = await runRouting(tx, r.q, r, { type: "USER", id: user.id }, "submit");
      const status = (await tx.quotation.findUnique({ where: { id: q.id }, select: { status: true } }))!.status;
      return { decision, status, risk: r.risk, totals: r.totals };
    });

    emit(id, { type: "status-changed", payload: { status: result.status } });
    return json(result);
  });
}
