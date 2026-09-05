import { z } from "zod";
import { prisma } from "@/lib/db";
import { authorize, handle, json, parseBody, requireUser } from "@/lib/api";
import { logAudit } from "@/lib/audit";

const schema = z.object({
  cells: z
    .array(
      z.object({
        tier: z.enum(["BRONZE", "SILVER", "GOLD"]),
        productId: z.string().min(1),
        /** null clears the override so the product falls back to its list price. */
        price: z.number().int().min(0).nullable(),
      }),
    )
    .min(1)
    .max(400),
});

/** PUT /api/config/price-list — tier-specific prices. Absent rows fall back to Product.listPrice. */
export async function PUT(req: Request) {
  return handle(async () => {
    const user = await requireUser();
    authorize(user, "config:all");
    const { cells } = await parseBody(req, schema);

    const changed = await prisma.$transaction(async (tx) => {
      const existing = await tx.priceListItem.findMany();
      const previous = new Map(existing.map((p) => [`${p.tier}:${p.productId}`, p.price]));
      let count = 0;
      for (const cell of cells) {
        const key = `${cell.tier}:${cell.productId}`;
        const from = previous.get(key);
        if (cell.price === null) {
          if (from === undefined) continue;
          await tx.priceListItem.delete({ where: { tier_productId: { tier: cell.tier, productId: cell.productId } } });
          count += 1;
          continue;
        }
        if (from === cell.price) continue;
        await tx.priceListItem.upsert({
          where: { tier_productId: { tier: cell.tier, productId: cell.productId } },
          create: { tier: cell.tier, productId: cell.productId, price: cell.price },
          update: { price: cell.price },
        });
        count += 1;
      }
      if (count) {
        await logAudit(tx, {
          entityType: "Config",
          entityId: "price-list",
          actor: { type: "USER", id: user.id },
          action: "config-updated",
          meta: { message: `${count} tier ${count === 1 ? "price" : "prices"} adjusted` },
        });
      }
      return count;
    });

    return json({ ok: true, changed });
  });
}
