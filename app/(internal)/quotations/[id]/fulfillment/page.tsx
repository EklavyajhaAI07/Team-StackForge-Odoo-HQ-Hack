import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSessionUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { getOrderForQuotation, nonShippableLines, outstandingDemand, physicalDemand, planFor, shipmentLines } from "@/lib/services/order";
import { getQuotationDetail } from "@/lib/services/quotation";
import { Fulfillment } from "@/components/fulfillment/Fulfillment";
import { ConfirmOrderPanel } from "@/components/fulfillment/ConfirmOrderPanel";

export const metadata: Metadata = { title: "Fulfillment" };

export default async function FulfillmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireSessionUser();
  const q = await getQuotationDetail(prisma, id);
  if (!q) notFound();

  const order = await getOrderForQuotation(prisma, id);
  if (!order) {
    return (
      <ConfirmOrderPanel
        quotationId={q.id}
        status={q.status}
        canConfirm={can(user, "quotation:confirm", { repId: q.repId })}
        physicalLines={q.lines.filter((l) => !l.isRecurring).length}
        recurringLines={q.lines.filter((l) => l.isRecurring).length}
      />
    );
  }

  const [{ result, stockable }, products, warehouses] = await Promise.all([
    planFor(prisma, order),
    prisma.product.findMany({ select: { id: true, name: true, unit: true }, orderBy: { name: "asc" } }),
    prisma.warehouse.findMany({ include: { stock: true }, orderBy: { shippingCostWeight: "asc" } }),
  ]);
  const remaining = outstandingDemand(order, stockable);
  const productName = Object.fromEntries(products.map((p) => [p.id, p.name]));

  return (
    <Fulfillment
      quotationId={q.id}
      order={{
        id: order.id,
        status: order.status,
        promisedDate: order.promisedDate?.toISOString() ?? null,
        shipments: order.shipments.map((s) => ({
          id: s.id,
          warehouseName: s.warehouse.name,
          warehouseCity: s.warehouse.city,
          status: s.status,
          cost: s.cost,
          lines: shipmentLines(s.lines).map((l) => ({ ...l, name: productName[l.productId] ?? l.productId })),
        })),
        backorders: order.backorders.map((b) => ({ id: b.id, productId: b.productId, name: b.product.name, qty: b.qty, status: b.status })),
      }}
      demand={physicalDemand(order, stockable)}
      nonShippable={nonShippableLines(order, stockable)}
      remaining={remaining}
      plans={result.plans}
      warehouses={warehouses.map((w) => ({
        id: w.id,
        name: w.name,
        city: w.city,
        shippingCostWeight: w.shippingCostWeight,
        stock: Object.fromEntries(w.stock.map((s) => [s.productId, s.qty])),
      }))}
      canDecide={can(user, "fulfillment:decide")}
    />
  );
}
