import { z } from "zod";
import { prisma } from "@/lib/db";
import { authorize, handle, json, parseBody, requireUser } from "@/lib/api";
import { emit } from "@/lib/sse";
import { cancelSubscription, previewCancellation } from "@/lib/services/billing";

const schema = z.object({
  lineId: z.string().min(1),
  effectiveAt: z.string().min(1),
  mode: z.enum(["PREVIEW", "APPLY"]).default("PREVIEW"),
});

/** POST — previews or confirms cancellation of one subscription line. */
export async function POST(req: Request, ctx: { params: Promise<{ orderId: string }> }) {
  return handle(async () => {
    const { orderId } = await ctx.params;
    const user = await requireUser();
    authorize(user, "billing:manage");
    const body = await parseBody(req, schema);
    const effectiveAt = new Date(body.effectiveAt);

    if (body.mode === "PREVIEW") return json(await previewCancellation(prisma, orderId, body.lineId, effectiveAt));

    const result = await prisma.$transaction((tx) =>
      cancelSubscription(tx, { orderId, lineId: body.lineId, effectiveAt, actor: { type: "USER", id: user.id } }),
    );
    emit(result.quotationId, { type: "billing-changed", payload: { action: "subscription-cancelled", creditNoteId: result.creditNote?.id } });
    return json(result);
  });
}
