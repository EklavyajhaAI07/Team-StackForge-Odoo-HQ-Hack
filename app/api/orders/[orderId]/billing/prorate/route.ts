import { z } from "zod";
import { prisma } from "@/lib/db";
import { authorize, handle, json, parseBody, requireUser } from "@/lib/api";
import { emit } from "@/lib/sse";
import { applyQuantityChange, previewQuantityChange } from "@/lib/services/billing";

const schema = z.object({
  lineId: z.string().min(1),
  newQty: z.number().int().min(1).max(100_000),
  effectiveAt: z.string().min(1),
  mode: z.enum(["PREVIEW", "APPLY"]).default("PREVIEW"),
});

/** POST — previews or applies a mid-cycle recurring-quantity change. */
export async function POST(req: Request, ctx: { params: Promise<{ orderId: string }> }) {
  return handle(async () => {
    const { orderId } = await ctx.params;
    const user = await requireUser();
    authorize(user, "billing:manage");
    const body = await parseBody(req, schema);
    const effectiveAt = new Date(body.effectiveAt);

    if (body.mode === "PREVIEW") return json(await previewQuantityChange(prisma, orderId, body.lineId, body.newQty, effectiveAt));

    const result = await prisma.$transaction((tx) =>
      applyQuantityChange(tx, { orderId, lineId: body.lineId, newQty: body.newQty, effectiveAt, actor: { type: "USER", id: user.id } }),
    );
    emit(result.quotationId, { type: "billing-changed", payload: { action: "qty-changed", invoiceId: result.invoice?.id } });
    return json(result);
  });
}
