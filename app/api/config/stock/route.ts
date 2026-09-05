import { z } from "zod";
import { prisma } from "@/lib/db";
import { authorize, handle, json, parseBody, requireUser } from "@/lib/api";
import { logAudit } from "@/lib/audit";

const schema = z.object({
  cells: z
    .array(z.object({ warehouseId: z.string().min(1), productId: z.string().min(1), qty: z.number().int().min(0).max(1_000_000) }))
    .min(1)
    .max(400),
});

/** PUT /api/config/stock — set on-hand quantities per warehouse and product. */
export async function PUT(req: Request) {
  return handle(async () => {
    const user = await requireUser();
    authorize(user, "config:all");
    const { cells } = await parseBody(req, schema);

    const changed = await prisma.$transaction(async (tx) => {
      const existing = await tx.stock.findMany();
      const previous = new Map(existing.map((s) => [`${s.warehouseId}:${s.productId}`, s.qty]));
      let count = 0;
      for (const cell of cells) {
        const from = previous.get(`${cell.warehouseId}:${cell.productId}`);
        if (from === cell.qty) continue;
        await tx.stock.upsert({
          where: { warehouseId_productId: { warehouseId: cell.warehouseId, productId: cell.productId } },
          create: { warehouseId: cell.warehouseId, productId: cell.productId, qty: cell.qty },
          update: { qty: cell.qty },
        });
        count += 1;
      }
      if (count) {
        await logAudit(tx, {
          entityType: "Warehouse",
          entityId: "stock",
          actor: { type: "USER", id: user.id },
          action: "config-updated",
          meta: { message: `${count} stock ${count === 1 ? "level" : "levels"} adjusted` },
        });
      }
      return count;
    });

    return json({ ok: true, changed });
  });
}
