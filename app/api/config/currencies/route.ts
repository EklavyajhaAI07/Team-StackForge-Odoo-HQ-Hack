import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, authorize, handle, json, parseBody, requireUser } from "@/lib/api";
import { logAudit } from "@/lib/audit";

const schema = z.object({
  rates: z.array(z.object({ code: z.string().min(3).max(3), rateFromBase: z.number().positive().max(100_000) })).max(50).optional(),
  assignments: z.array(z.object({ customerId: z.string().min(1), currencyCode: z.string().min(3).max(3) })).max(200).optional(),
});

/**
 * PUT /api/config/currencies — exchange rates, and which currency each customer is quoted in.
 *
 * Rates only affect quotations created from now on: every existing quotation carries the rate
 * it snapshotted, so re-rating a currency can never change a number a customer has already seen.
 */
export async function PUT(req: Request) {
  return handle(async () => {
    const user = await requireUser();
    authorize(user, "config:all");
    const body = await parseBody(req, schema);

    const result = await prisma.$transaction(async (tx) => {
      const changes: string[] = [];
      let rates = 0;
      let assignments = 0;

      for (const rate of body.rates ?? []) {
        const before = await tx.currency.findUnique({ where: { code: rate.code } });
        if (!before) throw new ApiError(404, `Unknown currency ${rate.code}`);
        // The base currency is the unit everything else is quoted against; it is always 1.
        if (before.isBase && rate.rateFromBase !== 1) {
          throw new ApiError(400, `${rate.code} is the base currency, so its rate is always 1`);
        }
        if (before.rateFromBase === rate.rateFromBase) continue;
        await tx.currency.update({ where: { code: rate.code }, data: { rateFromBase: rate.rateFromBase } });
        changes.push(`${rate.code} ${before.rateFromBase} → ${rate.rateFromBase}`);
        rates += 1;
      }

      for (const a of body.assignments ?? []) {
        const before = await tx.customer.findUnique({ where: { id: a.customerId }, select: { company: true, currencyCode: true } });
        if (!before) throw new ApiError(404, "Customer not found");
        if (before.currencyCode === a.currencyCode) continue;
        const exists = await tx.currency.findUnique({ where: { code: a.currencyCode }, select: { code: true } });
        if (!exists) throw new ApiError(404, `Unknown currency ${a.currencyCode}`);
        await tx.customer.update({ where: { id: a.customerId }, data: { currencyCode: a.currencyCode } });
        changes.push(`${before.company} now quoted in ${a.currencyCode}`);
        assignments += 1;
      }

      if (changes.length) {
        await logAudit(tx, {
          entityType: "Config",
          entityId: "currencies",
          actor: { type: "USER", id: user.id },
          action: "config-updated",
          meta: { message: changes.join(", ") },
        });
      }
      return { rates, assignments };
    });

    return json({ ok: true, ...result });
  });
}
