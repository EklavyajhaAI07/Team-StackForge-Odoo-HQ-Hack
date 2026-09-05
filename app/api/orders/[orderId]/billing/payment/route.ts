import { z } from "zod";
import { prisma } from "@/lib/db";
import { authorize, handle, json, parseBody, requireUser } from "@/lib/api";
import { emit } from "@/lib/sse";
import { recordPayment } from "@/lib/services/billing";

const schema = z.object({
  invoiceId: z.string().min(1),
  amount: z.number().int().positive(),
  method: z.string().trim().min(1).max(80),
});

/** POST — records a payment against one posted invoice. */
export async function POST(req: Request, ctx: { params: Promise<{ orderId: string }> }) {
  return handle(async () => {
    const { orderId } = await ctx.params;
    const user = await requireUser();
    authorize(user, "billing:manage");
    const body = await parseBody(req, schema);

    const result = await prisma.$transaction((tx) => recordPayment(tx, { ...body, orderId, actor: { type: "USER", id: user.id } }));
    emit(result.quotationId, { type: "billing-changed", payload: { action: "payment-recorded", invoiceId: body.invoiceId, status: result.status } });
    return json(result, { status: 201 });
  });
}
