import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, authorize, handle, json, parseBody, requireUser } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { emit } from "@/lib/sse";
import { orderDetailInclude } from "@/lib/services/order";

const schema = z.object({
  warehouseId: z.string().min(1),
  productId: z.string().min(1),
  qty: z.number().int().min(1).max(10_000),
});

/**
 * POST /api/orders/[orderId]/stock-arrival — §5.3 "Simulate stock arrival".
 * Adds stock, then reports whether OPEN backorders for that product can now be consolidated.
 */
export async function POST(req: Request, ctx: { params: Promise<{ orderId: string }> }) {
  return handle(async () => {
    const { orderId } = await ctx.params;
    const user = await requireUser();
    authorize(user, "fulfillment:decide");
    const body = await parseBody(req, schema);

    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId }, include: orderDetailInclude });
      if (!order) throw new ApiError(404, "Order not found");
      const [warehouse, product] = await Promise.all([
        tx.warehouse.findUnique({ where: { id: body.warehouseId } }),
        tx.product.findUnique({ where: { id: body.productId } }),
      ]);
      if (!warehouse) throw new ApiError(404, "Warehouse not found");
      if (!product) throw new ApiError(404, "Product not found");

      const stock = await tx.stock.upsert({
        where: { warehouseId_productId: { warehouseId: body.warehouseId, productId: body.productId } },
        create: { warehouseId: body.warehouseId, productId: body.productId, qty: body.qty },
        update: { qty: { increment: body.qty } },
      });

      await logAudit(
        tx,
        {
          entityType: "Order",
          entityId: order.id,
          actor: { type: "USER", id: user.id },
          action: "stock-arrived",
          meta: { warehouse: warehouse.name, product: product.name, qty: body.qty, onHand: stock.qty },
        },
        order.quotationId,
      );

      const open = order.backorders.filter((b) => b.status === "OPEN" && b.productId === body.productId);
      const openQty = open.reduce((s, b) => s + b.qty, 0);
      return {
        quotationId: order.quotationId,
        onHand: stock.qty,
        warehouseName: warehouse.name,
        productName: product.name,
        canConsolidate: open.length > 0 && stock.qty > 0,
        openBackorderQty: openQty,
        fulfillableQty: Math.min(openQty, stock.qty),
      };
    });

    emit(result.quotationId, { type: "fulfillment-changed", payload: { stockArrival: true } });
    return json(result);
  });
}
