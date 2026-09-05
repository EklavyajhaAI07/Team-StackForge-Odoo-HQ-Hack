import { z } from "zod";
import { prisma } from "@/lib/db";
import { authorize, handle, json, parseBody, requireUser } from "@/lib/api";
import { emit } from "@/lib/sse";
import { generateRecurringInvoice } from "@/lib/services/billing";

const schema = z.object({ entryId: z.string().min(1) });

/** POST — turns one due BillingEntry into a posted recurring invoice. */
export async function POST(req: Request, ctx: { params: Promise<{ orderId: string }> }) {
  return handle(async () => {
    const { orderId } = await ctx.params;
    const user = await requireUser();
    authorize(user, "billing:manage");
    const { entryId } = await parseBody(req, schema);

    const result = await prisma.$transaction((tx) => generateRecurringInvoice(tx, { orderId, entryId, actor: { type: "USER", id: user.id } }));
    emit(result.quotationId, { type: "billing-changed", payload: { action: "invoice-generated", invoiceId: result.invoice.id } });
    return json(result, { status: 201 });
  });
}
