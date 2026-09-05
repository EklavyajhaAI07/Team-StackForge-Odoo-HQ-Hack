import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, authorize, handle, json, parseBody, requireUser } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { emit } from "@/lib/sse";
import { validateOverride } from "@/lib/engine/split";
import { crossedBelowReorderPoint } from "@/lib/engine/replenishment";
import { deriveOrderStatusFor, getOrderForQuotation, oneTimeProductIds, orderDetailInclude, outstandingDemand, planFor, stockableProductIds, warehouseInputs } from "@/lib/services/order";

const schema = z.object({
  mode: z.enum(["ACCEPT", "OVERRIDE"]),
  planKey: z.string().optional(),
  /** warehouseId → productId → qty */
  allocation: z.record(z.string(), z.record(z.string(), z.number().int().min(0))).optional(),
});

/**
 * POST /api/orders/[orderId]/split — turn a plan into Shipments (+ Backorders) and decrement Stock.
 * ACCEPT uses one of the computed plans; OVERRIDE uses the operator's own per-warehouse table.
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
      const stockable = await stockableProductIds(tx, oneTimeProductIds(order));
      const demand = outstandingDemand(order, stockable);
      if (demand.length === 0) throw new ApiError(409, "Everything on this order is already assigned to a shipment");

      let plan;
      if (body.mode === "ACCEPT") {
        const { result: planned } = await planFor(tx, order);
        plan = body.planKey ? planned.plans.find((p) => p.key === body.planKey) : planned.recommended;
        if (!plan) throw new ApiError(400, "That plan is no longer available — reload and try again");
      } else {
        if (!body.allocation) throw new ApiError(400, "Enter quantities for at least one warehouse");
        const warehouses = await warehouseInputs(tx, demand.map((d) => d.productId));
        const validated = validateOverride(demand, warehouses, body.allocation);
        if (!validated.ok) throw new ApiError(400, validated.errors[0], validated.errors);
        if (validated.plan.shipments.length === 0) throw new ApiError(400, "Assign at least one unit to a warehouse");
        plan = validated.plan;
      }

      // Snapshot the levels this shipment can touch, so we can tell afterwards which lines
      // crossed their reorder point on this fulfillment rather than were already low.
      const touched = [...new Set(plan.shipments.flatMap((s) => s.lines.map((l) => l.productId)))];
      const stockBefore = await tx.stock.findMany({
        where: { productId: { in: touched } },
        select: { warehouseId: true, productId: true, qty: true, reorderPoint: true },
      });

      for (const shipment of plan.shipments) {
        await tx.shipment.create({
          data: {
            orderId: order.id,
            warehouseId: shipment.warehouseId,
            status: "PLANNED",
            cost: shipment.cost,
            lines: shipment.lines.map((l) => ({ productId: l.productId, qty: l.qty })),
          },
        });
        for (const line of shipment.lines) {
          await tx.stock.update({
            where: { warehouseId_productId: { warehouseId: shipment.warehouseId, productId: line.productId } },
            data: { qty: { decrement: line.qty } },
          });
        }
      }

      for (const b of plan.backorders) {
        await tx.backorder.create({ data: { orderId: order.id, productId: b.productId, qty: b.qty, status: "OPEN" } });
      }

      const stockAfter = await tx.stock.findMany({
        where: { productId: { in: touched } },
        select: { warehouseId: true, productId: true, qty: true, reorderPoint: true },
      });
      const crossed = crossedBelowReorderPoint(stockBefore, stockAfter);

      const after = await tx.order.findUnique({ where: { id: order.id }, include: orderDetailInclude });
      const status = await deriveOrderStatusFor(tx, after!, after!.shipments.length);
      await tx.order.update({ where: { id: order.id }, data: { status } });

      await logAudit(
        tx,
        {
          entityType: "Order",
          entityId: order.id,
          actor: { type: "USER", id: user.id },
          action: body.mode === "ACCEPT" ? "split-accepted" : "split-overridden",
          meta: {
            plan: plan.label,
            warehouses: plan.shipments.map((s) => s.warehouseName),
            backorderedUnits: plan.backorderedUnits,
            shippingCost: plan.totalCost,
          },
        },
        order.quotationId,
      );
      // The replenishment rule only earns its place if it says something when it fires.
      let replenishment: { productName: string; warehouseName: string; qty: number; reorderPoint: number; suggestedOrderQty: number }[] = [];
      if (crossed.length) {
        const [names, houses] = await Promise.all([
          tx.product.findMany({ where: { id: { in: crossed.map((c) => c.productId) } }, select: { id: true, name: true } }),
          tx.warehouse.findMany({ where: { id: { in: crossed.map((c) => c.warehouseId) } }, select: { id: true, name: true } }),
        ]);
        const productName = new Map(names.map((n) => [n.id, n.name]));
        const warehouseName = new Map(houses.map((h) => [h.id, h.name]));
        replenishment = crossed.map((c) => ({
          productName: productName.get(c.productId) ?? c.productId,
          warehouseName: warehouseName.get(c.warehouseId) ?? c.warehouseId,
          qty: c.qty,
          reorderPoint: c.reorderPoint,
          suggestedOrderQty: c.suggestedOrderQty,
        }));
        await logAudit(
          tx,
          {
            entityType: "Order",
            entityId: order.id,
            actor: { type: "SYSTEM" },
            action: "reorder-point-reached",
            meta: {
              message: replenishment
                .map((r) => `${r.productName} at ${r.warehouseName} down to ${r.qty}, reorder point ${r.reorderPoint}`)
                .join("; "),
              lines: replenishment,
            },
          },
          order.quotationId,
        );
      }

      return {
        quotationId: order.quotationId,
        status,
        shipments: plan.shipments.length,
        backorders: plan.backorders.length,
        label: plan.label,
        replenishment,
      };
    });

    emit(result.quotationId, { type: "fulfillment-changed", payload: { status: result.status } });
    return json(result);
  });
}

/** GET /api/orders/[orderId]/split — the current comparison of plans (used by the manual-override modal). */
export async function GET(_req: Request, ctx: { params: Promise<{ orderId: string }> }) {
  return handle(async () => {
    const { orderId } = await ctx.params;
    const user = await requireUser();
    authorize(user, "quotation:view");
    const order = await prisma.order.findUnique({ where: { id: orderId }, include: orderDetailInclude });
    if (!order) throw new ApiError(404, "Order not found");
    const { demand, warehouses, result } = await planFor(prisma, order);
    void getOrderForQuotation;
    return json({ demand, warehouses, plans: result.plans });
  });
}
