import { z } from "zod";
import { prisma } from "@/lib/db";
import { authorize, handle, json, parseBody, requireUser } from "@/lib/api";
import { emit } from "@/lib/sse";
import { afterLinesChanged, assertEditable, requireQuotation } from "@/lib/services/quotation";

const schema = z.object({ pct: z.number().min(0).max(100) });

/**
 * POST /api/quotations/[id]/discount — order-level discount.
 * DECISION: the schema has no order-level discount column, so "order-level" means the same
 * percentage is applied to every line; risk and ceilings stay per-line, exactly as §5.1 defines them.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await ctx.params;
    const user = await requireUser();
    const { pct } = await parseBody(req, schema);

    const result = await prisma.$transaction(async (tx) => {
      const q = await requireQuotation(tx, id);
      authorize(user, "quotation:edit", { repId: q.repId });
      assertEditable(q);
      await tx.quotationLine.updateMany({ where: { quotationId: q.id }, data: { discountPct: pct } });
      return afterLinesChanged(tx, q.id, { type: "USER", id: user.id }, { action: "order-discount-applied", meta: { pct, lines: q.lines.length } });
    });

    emit(id, { type: "lines-changed", payload: { status: result.status } });
    return json({ ok: true, status: result.status, risk: result.risk, totals: result.totals, rerouted: result.decision?.kind ?? null });
  });
}
