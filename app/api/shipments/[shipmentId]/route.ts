import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, authorize, handle, json, parseBody, requireUser } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { emit } from "@/lib/sse";
import { deriveOrderStatusFor, orderDetailInclude } from "@/lib/services/order";

const schema = z.object({ status: z.enum(["PLANNED", "SHIPPED", "DELIVERED"]) });

/** PATCH /api/shipments/[shipmentId] — move a shipment along; order status follows. */
export async function PATCH(req: Request, ctx: { params: Promise<{ shipmentId: string }> }) {
  return handle(async () => {
    const { shipmentId } = await ctx.params;
    const user = await requireUser();
    authorize(user, "fulfillment:decide");
    const { status } = await parseBody(req, schema);

    const result = await prisma.$transaction(async (tx) => {
      const shipment = await tx.shipment.findUnique({ where: { id: shipmentId }, include: { warehouse: true } });
      if (!shipment) throw new ApiError(404, "Shipment not found");
      await tx.shipment.update({ where: { id: shipmentId }, data: { status } });

      const order = await tx.order.findUnique({ where: { id: shipment.orderId }, include: orderDetailInclude });
      const orderStatus = await deriveOrderStatusFor(tx, order!, order!.shipments.length);
      await tx.order.update({ where: { id: shipment.orderId }, data: { status: orderStatus } });

      await logAudit(
        tx,
        {
          entityType: "Order",
          entityId: shipment.orderId,
          actor: { type: "USER", id: user.id },
          action: "shipment-status",
          meta: { warehouse: shipment.warehouse.name, message: `marked ${status.toLowerCase()}` },
        },
        order!.quotationId,
      );
      return { quotationId: order!.quotationId, orderStatus };
    });

    emit(result.quotationId, { type: "fulfillment-changed", payload: { status: result.orderStatus } });
    return json(result);
  });
}
