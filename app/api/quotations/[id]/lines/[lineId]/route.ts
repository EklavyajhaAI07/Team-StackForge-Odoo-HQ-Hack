import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, authorize, handle, json, parseBody, requireUser } from "@/lib/api";
import { effectiveListPrice } from "@/lib/engine/risk";
import { emit } from "@/lib/sse";
import { afterLinesChanged, assertEditable, getTierPrices, requireQuotation } from "@/lib/services/quotation";

const patchSchema = z.object({
  qty: z.number().int().min(1).max(10_000).optional(),
  discountPct: z.number().min(0).max(100).optional(),
  variantId: z.string().min(1).nullable().optional(),
  planId: z.string().min(1).nullable().optional(),
});

/** PATCH /api/quotations/[id]/lines/[lineId] — qty, discount, variant or plan. */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string; lineId: string }> }) {
  return handle(async () => {
    const { id, lineId } = await ctx.params;
    const user = await requireUser();
    const body = await parseBody(req, patchSchema);

    const result = await prisma.$transaction(async (tx) => {
      const q = await requireQuotation(tx, id);
      authorize(user, "quotation:edit", { repId: q.repId });
      assertEditable(q);
      const line = q.lines.find((l) => l.id === lineId);
      if (!line) throw new ApiError(404, "Line not found on this quotation");

      const data: { qty?: number; discountPct?: number; variantId?: string | null; planId?: string | null; unitPrice?: number } = {};
      if (body.qty != null) data.qty = body.qty;
      if (body.discountPct != null) data.discountPct = body.discountPct;

      if (body.variantId !== undefined) {
        const v = body.variantId ? line.product.variants.find((x) => x.id === body.variantId) : null;
        if (body.variantId && !v) throw new ApiError(400, "That variant does not belong to this product");
        data.variantId = v?.id ?? null;
        const tierPrices = await getTierPrices(tx, q.customer.tier);
        data.unitPrice = effectiveListPrice({
          listPrice: line.product.listPrice,
          tierPrice: tierPrices.get(line.productId) ?? null,
          variantExtra: v?.extraPrice ?? 0,
        });
      }
      if (body.planId !== undefined) {
        if (!line.isRecurring) throw new ApiError(400, "Only subscription lines have a billing plan");
        if (!body.planId) throw new ApiError(400, "Subscription lines need a billing plan");
        const plan = await tx.subscriptionPlan.findUnique({ where: { id: body.planId } });
        if (!plan) throw new ApiError(404, "Plan not found");
        data.planId = plan.id;
      }

      const updated = await tx.quotationLine.update({ where: { id: lineId }, data });
      const changed: Record<string, unknown> = { product: line.product.name };
      if (data.qty != null && data.qty !== line.qty) changed.qty = { from: line.qty, to: data.qty };
      if (data.discountPct != null && data.discountPct !== line.discountPct) changed.discountPct = { from: line.discountPct, to: data.discountPct };
      if (data.variantId !== undefined) changed.variantId = data.variantId;
      if (data.planId !== undefined) changed.planId = data.planId;

      const after = await afterLinesChanged(tx, q.id, { type: "USER", id: user.id }, { action: "line-updated", meta: changed });
      return { line: updated, after };
    });

    emit(id, { type: "lines-changed", payload: { status: result.after.status } });
    return json({
      line: result.line,
      status: result.after.status,
      risk: result.after.risk,
      totals: result.after.totals,
      rerouted: result.after.decision?.kind ?? null,
    });
  });
}

/** DELETE /api/quotations/[id]/lines/[lineId] */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string; lineId: string }> }) {
  return handle(async () => {
    const { id, lineId } = await ctx.params;
    const user = await requireUser();

    const result = await prisma.$transaction(async (tx) => {
      const q = await requireQuotation(tx, id);
      authorize(user, "quotation:edit", { repId: q.repId });
      assertEditable(q);
      const line = q.lines.find((l) => l.id === lineId);
      if (!line) throw new ApiError(404, "Line not found on this quotation");
      await tx.quotationLine.delete({ where: { id: lineId } });
      return afterLinesChanged(tx, q.id, { type: "USER", id: user.id }, { action: "line-removed", meta: { product: line.product.name, qty: line.qty } });
    });

    emit(id, { type: "lines-changed", payload: { status: result.status } });
    return json({ ok: true, status: result.status, risk: result.risk, totals: result.totals, rerouted: result.decision?.kind ?? null });
  });
}
