import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, authorize, handle, json, parseBody, requireUser } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { emit } from "@/lib/sse";
import { deriveOrderStatusFor, orderDetailInclude, warehouseInputs } from "@/lib/services/order";

const schema = z.object({ productId: z.string().min(1).optional() });

/**
 * POST /api/orders/[orderId]/consolidate — one click turns OPEN backorders into a single
 * consolidation shipment from whichever warehouses now hold the stock (cheapest first).
 */
export async function POST(req: Request, ctx: { params: Promise<{ orderId: string }> }) {
  return handle(async () => {
    const { orderId } = await ctx.params;
    const user = await requireUser();
    authorize(user, "fulfillment:decide");
    const { productId } = await parseBody(req, schema);

    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId }, include: orderDetailInclude });
      if (!order) throw new ApiError(404, "Order not found");
      const open = order.backorders.filter((b) => b.status === "OPEN" && (!productId || b.productId === productId));
      if (open.length === 0) throw new ApiError(409, "There are no open backorders to consolidate");

      const need = new Map<string, number>();
      for (const b of open) need.set(b.productId, (need.get(b.productId) ?? 0) + b.qty);
      const warehouses = await warehouseInputs(tx, [...need.keys()]);

      // Cheapest warehouse first; consolidate into as few shipments as possible.
      const shipments: { warehouseId: string; warehouseName: string; cost: number; lines: { productId: string; qty: number }[] }[] = [];
      for (const w of [...warehouses].sort((a, b) => a.shippingCostWeight - b.shippingCostWeight)) {
        const lines: { productId: string; qty: number }[] = [];
        for (const [pid, qty] of need) {
          if (qty <= 0) continue;
          const take = Math.min(w.stock[pid] ?? 0, qty);
          if (take > 0) {
            lines.push({ productId: pid, qty: take });
            need.set(pid, qty - take);
          }
        }
        if (lines.length) shipments.push({ warehouseId: w.id, warehouseName: w.name, cost: w.shippingCostWeight, lines });
        if ([...need.values()].every((q) => q <= 0)) break;
      }
      if (shipments.length === 0) throw new ApiError(409, "No warehouse has stock for these backorders yet — simulate an arrival first");

      const shippedByProduct = new Map<string, number>();
      for (const s of shipments) {
        await tx.shipment.create({
          data: { orderId: order.id, warehouseId: s.warehouseId, status: "PLANNED", cost: s.cost, lines: s.lines },
        });
        for (const l of s.lines) {
          await tx.stock.update({
            where: { warehouseId_productId: { warehouseId: s.warehouseId, productId: l.productId } },
            data: { qty: { decrement: l.qty } },
          });
          shippedByProduct.set(l.productId, (shippedByProduct.get(l.productId) ?? 0) + l.qty);
        }
      }

      // Close backorders that are now covered; shrink one that is only partly covered.
      let closed = 0;
      for (const b of open) {
        const available = shippedByProduct.get(b.productId) ?? 0;
        if (available >= b.qty) {
          await tx.backorder.update({ where: { id: b.id }, data: { status: "CONSOLIDATED" } });
          shippedByProduct.set(b.productId, available - b.qty);
          closed += 1;
        } else if (available > 0) {
          await tx.backorder.update({ where: { id: b.id }, data: { qty: b.qty - available } });
          shippedByProduct.set(b.productId, 0);
        }
      }

      const after = await tx.order.findUnique({ where: { id: order.id }, include: orderDetailInclude });
      const status = await deriveOrderStatusFor(tx, after!, after!.shipments.length);
      await tx.order.update({ where: { id: order.id }, data: { status } });

      await logAudit(
        tx,
        {
          entityType: "Order",
          entityId: order.id,
          actor: { type: "USER", id: user.id },
          action: "backorder-consolidated",
          meta: {
            warehouse: shipments.map((s) => s.warehouseName).join(", "),
            shipments: shipments.length,
            backordersClosed: closed,
            units: shipments.reduce((sum, s) => sum + s.lines.reduce((x, l) => x + l.qty, 0), 0),
          },
        },
        order.quotationId,
      );
      return { quotationId: order.quotationId, status, shipments: shipments.length, backordersClosed: closed };
    });

    emit(result.quotationId, { type: "fulfillment-changed", payload: { status: result.status } });
    return json(result);
  });
}
