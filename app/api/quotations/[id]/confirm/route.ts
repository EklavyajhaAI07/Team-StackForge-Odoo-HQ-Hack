import { prisma } from "@/lib/db";
import { authorize, handle, json, requireUser } from "@/lib/api";
import { emit } from "@/lib/sse";
import { confirmQuotation } from "@/lib/services/order";
import { requireQuotation } from "@/lib/services/quotation";

/** POST /api/quotations/[id]/confirm — confirm internally (the customer path lives in the portal API). */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await ctx.params;
    const user = await requireUser();

    const result = await prisma.$transaction(async (tx) => {
      const q = await requireQuotation(tx, id);
      authorize(user, "quotation:confirm", { repId: q.repId });
      return confirmQuotation(tx, id, { type: "USER", id: user.id }, { via: "internal" });
    });

    emit(id, { type: "status-changed", payload: { status: "CONFIRMED" } });
    return json({ orderId: result.order.id, created: result.created, status: "CONFIRMED" });
  });
}
