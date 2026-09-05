import { z } from "zod";
import { prisma } from "@/lib/db";
import { authorize, handle, json, parseBody, requireUser } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { belowReorderPoint } from "@/lib/engine/replenishment";

const schema = z.object({
  cells: z
    .array(
      z.object({
        warehouseId: z.string().min(1),
        productId: z.string().min(1),
        qty: z.number().int().min(0).max(1_000_000),
        // The replenishment rule (§A4). 0 switches it off for that line.
        reorderPoint: z.number().int().min(0).max(1_000_000),
      }),
    )
    .min(1)
    .max(400),
});

/** PUT /api/config/stock — set on-hand quantities per warehouse and product. */
export async function PUT(req: Request) {
  return handle(async () => {
    const user = await requireUser();
    authorize(user, "config:all");
    const { cells } = await parseBody(req, schema);

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.stock.findMany();
      const previous = new Map(existing.map((s) => [`${s.warehouseId}:${s.productId}`, s]));
      let levels = 0;
      let points = 0;

      for (const cell of cells) {
        const from = previous.get(`${cell.warehouseId}:${cell.productId}`);
        const qtyChanged = from?.qty !== cell.qty;
        const pointChanged = from?.reorderPoint !== cell.reorderPoint;
        if (from && !qtyChanged && !pointChanged) continue;
        await tx.stock.upsert({
          where: { warehouseId_productId: { warehouseId: cell.warehouseId, productId: cell.productId } },
          create: { warehouseId: cell.warehouseId, productId: cell.productId, qty: cell.qty, reorderPoint: cell.reorderPoint },
          update: { qty: cell.qty, reorderPoint: cell.reorderPoint },
        });
        if (!from || qtyChanged) levels += 1;
        if (!from || pointChanged) points += 1;
      }

      const parts: string[] = [];
      if (levels) parts.push(`${levels} stock ${levels === 1 ? "level" : "levels"} adjusted`);
      if (points) parts.push(`${points} reorder ${points === 1 ? "point" : "points"} set`);
      if (parts.length) {
        await logAudit(tx, {
          entityType: "Warehouse",
          entityId: "stock",
          actor: { type: "USER", id: user.id },
          action: "config-updated",
          meta: { message: parts.join(", ") },
        });
      }

      // Report what the new configuration leaves needing a restock, so the screen can say so
      // straight away rather than waiting for the next fulfillment to notice.
      const after = await tx.stock.findMany({ select: { warehouseId: true, productId: true, qty: true, reorderPoint: true } });
      return { levels, points, lowCount: belowReorderPoint(after).length };
    });

    return json({ ok: true, changed: result.levels, reorderPointsChanged: result.points, lowCount: result.lowCount });
  });
}
