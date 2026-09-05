import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, authorize, handle, json, parseBody, requireUser } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { nextQuotationNumber } from "@/lib/quotes";

const createSchema = z.object({ customerId: z.string().min(1) });

/** POST /api/quotations — create an empty DRAFT for a customer. */
export async function POST(req: Request) {
  return handle(async () => {
    const user = await requireUser();
    authorize(user, "quotation:create");
    const { customerId } = await parseBody(req, createSchema);
    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) throw new ApiError(404, "Customer not found");

    const quotation = await prisma.$transaction(async (tx) => {
      const numbers = await tx.quotation.findMany({ select: { number: true } });
      const number = nextQuotationNumber(numbers.map((n) => n.number));
      const q = await tx.quotation.create({
        data: {
          number,
          customerId,
          repId: user.id,
          status: "DRAFT",
          promisedDate: new Date(Date.now() + 14 * 86_400_000),
        },
      });
      await logAudit(tx, {
        entityType: "Quotation",
        entityId: q.id,
        actor: { type: "USER", id: user.id },
        action: "created",
        meta: { customer: customer.company, tier: customer.tier },
      });
      return q;
    });

    return json({ id: quotation.id, number: quotation.number }, { status: 201 });
  });
}
