import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, authorize, handle, json, parseBody, requireUser } from "@/lib/api";
import { effectiveListPrice } from "@/lib/engine/risk";
import { emit } from "@/lib/sse";
import { afterLinesChanged, assertEditable, getTierPrices, requireQuotation } from "@/lib/services/quotation";

const schema = z.object({
  productId: z.string().min(1),
  variantId: z.string().min(1).optional().nullable(),
  planId: z.string().min(1).optional().nullable(),
  qty: z.number().int().min(1).max(10_000).default(1),
  discountPct: z.number().min(0).max(100).default(0),
});

/** POST /api/quotations/[id]/lines — add a product (merges into an identical existing line). */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await ctx.params;
    const user = await requireUser();
    const body = await parseBody(req, schema);

    const result = await prisma.$transaction(async (tx) => {
      const q = await requireQuotation(tx, id);
      authorize(user, "quotation:edit", { repId: q.repId });
      assertEditable(q);

      const product = await tx.product.findUnique({ where: { id: body.productId }, include: { variants: true } });
      if (!product) throw new ApiError(404, "Product not found");

      let variantId: string | null = null;
      if (product.variants.length > 0) {
        const v = body.variantId ? product.variants.find((x) => x.id === body.variantId) : product.variants[0];
        if (!v) throw new ApiError(400, "Pick a valid variant for this product");
        variantId = v.id;
      }

      let planId: string | null = null;
      if (product.kind === "RECURRING") {
        // DECISION: recurring products default to the first plan by interval (Monthly) when none is chosen.
        const plan = body.planId
          ? await tx.subscriptionPlan.findUnique({ where: { id: body.planId } })
          : await tx.subscriptionPlan.findFirst({ orderBy: [{ interval: "asc" }, { name: "asc" }] });
        if (!plan) throw new ApiError(400, "Subscription products need a billing plan — add one in the backend");
        planId = plan.id;
      }

      const tierPrices = await getTierPrices(tx, q.customer.tier);
      const variantExtra = variantId ? product.variants.find((v) => v.id === variantId)!.extraPrice : 0;
      const unitPrice = effectiveListPrice({ listPrice: product.listPrice, tierPrice: tierPrices.get(product.id) ?? null, variantExtra });

      const existing = q.lines.find((l) => l.productId === product.id && l.variantId === variantId && l.planId === planId);
      let line;
      if (existing) {
        line = await tx.quotationLine.update({
          where: { id: existing.id },
          data: { qty: existing.qty + body.qty, discountPct: body.discountPct || existing.discountPct },
        });
      } else {
        line = await tx.quotationLine.create({
          data: {
            quotationId: q.id,
            productId: product.id,
            variantId,
            planId,
            qty: body.qty,
            unitPrice,
            discountPct: body.discountPct,
            isRecurring: product.kind === "RECURRING",
          },
        });
      }

      const after = await afterLinesChanged(tx, q.id, { type: "USER", id: user.id }, {
        action: existing ? "line-updated" : "line-added",
        meta: { product: product.name, qty: line.qty, discountPct: line.discountPct, unitPrice },
      });
      return { line, after };
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
