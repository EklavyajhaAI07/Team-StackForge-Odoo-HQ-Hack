// Order domain service: confirmation (order + billing artefacts) and fulfillment helpers.
import type { Prisma } from "@prisma/client";
import { prisma, type Tx } from "@/lib/db";
import { ApiError } from "@/lib/api";
import { logAudit, type AuditActor } from "@/lib/audit";
import { buildSchedule, type Interval } from "@/lib/engine/proration";
import { planSplit, type DemandLine, type WarehouseInput } from "@/lib/engine/split";
import { lineNet, quotationTotals } from "@/lib/quotes";
import { requireQuotation, type QuotationDetail } from "./quotation";

type Db = Tx | typeof prisma;

export const RECURRING_CYCLES = 3;

export const orderDetailInclude = {
  shipments: { include: { warehouse: true }, orderBy: { id: "asc" } },
  backorders: { include: { product: true }, orderBy: { id: "asc" } },
  invoices: { include: { payments: { orderBy: { paidAt: "asc" } } }, orderBy: { id: "asc" } },
  schedule: { orderBy: { billOn: "asc" } },
  quotation: {
    include: {
      customer: true,
      lines: { include: { product: true, plan: true, variant: true }, orderBy: { id: "asc" } },
    },
  },
} satisfies Prisma.OrderInclude;

export type OrderDetail = Prisma.OrderGetPayload<{ include: typeof orderDetailInclude }>;

export async function getOrderForQuotation(db: Db, quotationId: string): Promise<OrderDetail | null> {
  return db.order.findUnique({ where: { quotationId }, include: orderDetailInclude });
}

/**
 * §5.4 — confirming a quotation creates the order, posts one ONE_TIME invoice covering all
 * one-time lines (incl. tax), and lays down BillingEntry rows for the next 3 cycles of each
 * recurring line. Idempotent: an existing order is returned untouched.
 */
export async function confirmQuotation(
  tx: Db,
  quotationId: string,
  actor: AuditActor,
  opts: { via: "internal" | "portal" },
): Promise<{ order: { id: string }; created: boolean }> {
  const q: QuotationDetail = await requireQuotation(tx, quotationId);
  const existing = await tx.order.findUnique({ where: { quotationId }, select: { id: true } });
  if (existing) return { order: existing, created: false };

  if (q.lines.length === 0) throw new ApiError(400, "Add at least one line before confirming");
  if (!["APPROVED", "SENT", "UNDER_NEGOTIATION", "CONFIRMED"].includes(q.status)) {
    throw new ApiError(409, "This quotation still needs approval before it can be confirmed");
  }

  const confirmedAt = new Date();
  const promisedDate = q.promisedDate ?? new Date(confirmedAt.getTime() + 7 * 86_400_000);
  const order = await tx.order.create({ data: { quotationId: q.id, status: "CONFIRMED", promisedDate } });

  const oneTime = q.lines.filter((l) => !l.isRecurring);
  if (oneTime.length > 0) {
    const totals = quotationTotals(oneTime);
    await tx.invoice.create({
      data: {
        orderId: order.id,
        kind: "ONE_TIME",
        amount: totals.net,
        tax: totals.tax,
        status: "POSTED",
        dueDate: new Date(confirmedAt.getTime() + 30 * 86_400_000),
      },
    });
  }

  let recurringLines = 0;
  for (const l of q.lines.filter((x) => x.isRecurring)) {
    const interval = (l.plan?.interval ?? "MONTHLY") as Interval;
    const schedule = buildSchedule({ anchor: confirmedAt, interval, cycles: RECURRING_CYCLES, amountPerCycle: lineNet(l) });
    for (const s of schedule) {
      await tx.billingEntry.create({ data: { orderId: order.id, lineId: l.id, billOn: s.billOn, amount: s.amount, status: "SCHEDULED" } });
    }
    recurringLines += 1;
  }

  await tx.quotation.update({ where: { id: q.id }, data: { status: "CONFIRMED" } });
  await logAudit(tx, {
    entityType: "Quotation",
    entityId: q.id,
    actor,
    action: "confirmed",
    meta: { via: opts.via },
  });
  await logAudit(
    tx,
    {
      entityType: "Order",
      entityId: order.id,
      actor: { type: "SYSTEM" },
      action: "order-created",
      meta: {
        quotation: q.number,
        oneTimeLines: oneTime.length,
        oneTimeInvoice: oneTime.length ? quotationTotals(oneTime).total : 0,
        recurringLines,
        recurringCycles: RECURRING_CYCLES,
      },
    },
    q.id,
  );

  return { order, created: true };
}

/**
 * Products that actually move through a warehouse: those carrying at least one Stock row.
 * Services and subscriptions are never stocked, so they never reach a shipment or a backorder.
 * DECISION: "stockable" is derived from inventory data rather than a hardcoded category name,
 * so stocking a service in the backend would correctly make it shippable.
 */
export async function stockableProductIds(db: Db, productIds: string[]): Promise<Set<string>> {
  if (productIds.length === 0) return new Set();
  const rows = await db.stock.findMany({
    where: { productId: { in: productIds } },
    select: { productId: true },
    distinct: ["productId"],
  });
  return new Set(rows.map((r) => r.productId));
}

/** One-time lines on this order, whether or not they are stockable. */
export function oneTimeProductIds(order: OrderDetail): string[] {
  return [...new Set(order.quotation.lines.filter((l) => !l.isRecurring).map((l) => l.productId))];
}

/** Physical demand = one-time lines for stocked products. Services and subscriptions do not ship. */
export function physicalDemand(order: OrderDetail, stockable?: Set<string>): DemandLine[] {
  const byProduct = new Map<string, DemandLine>();
  for (const l of order.quotation.lines) {
    if (l.isRecurring) continue;
    if (stockable && !stockable.has(l.productId)) continue;
    const cur = byProduct.get(l.productId);
    if (cur) cur.qty += l.qty;
    else byProduct.set(l.productId, { productId: l.productId, name: l.product.name, qty: l.qty });
  }
  return [...byProduct.values()];
}

/** One-time lines that never ship (no stock anywhere) — shown on the screen so nothing looks lost. */
export function nonShippableLines(order: OrderDetail, stockable: Set<string>): { productId: string; name: string; qty: number }[] {
  const byProduct = new Map<string, { productId: string; name: string; qty: number }>();
  for (const l of order.quotation.lines) {
    if (l.isRecurring || stockable.has(l.productId)) continue;
    const cur = byProduct.get(l.productId);
    if (cur) cur.qty += l.qty;
    else byProduct.set(l.productId, { productId: l.productId, name: l.product.name, qty: l.qty });
  }
  return [...byProduct.values()];
}

/** Demand still unshipped: ordered minus what shipments already cover. */
export function outstandingDemand(order: OrderDetail, stockable?: Set<string>): DemandLine[] {
  const remaining = new Map(physicalDemand(order, stockable).map((d) => [d.productId, { ...d }]));
  for (const s of order.shipments) {
    for (const line of shipmentLines(s.lines)) {
      const r = remaining.get(line.productId);
      if (r) r.qty = Math.max(0, r.qty - line.qty);
    }
  }
  return [...remaining.values()].filter((d) => d.qty > 0);
}

export type ShipmentLine = { productId: string; qty: number };

export function shipmentLines(json: Prisma.JsonValue): ShipmentLine[] {
  if (!Array.isArray(json)) return [];
  return json.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const o = entry as Record<string, unknown>;
    return typeof o.productId === "string" && typeof o.qty === "number" ? [{ productId: o.productId, qty: o.qty }] : [];
  });
}

export async function warehouseInputs(db: Db, productIds: string[]): Promise<WarehouseInput[]> {
  const warehouses = await db.warehouse.findMany({
    include: { stock: { where: productIds.length ? { productId: { in: productIds } } : undefined } },
    orderBy: { shippingCostWeight: "asc" },
  });
  return warehouses.map((w) => ({
    id: w.id,
    name: w.name,
    shippingCostWeight: w.shippingCostWeight,
    stock: Object.fromEntries(w.stock.map((s) => [s.productId, s.qty])),
  }));
}

export async function planFor(db: Db, order: OrderDetail) {
  const stockable = await stockableProductIds(db, oneTimeProductIds(order));
  const demand = outstandingDemand(order, stockable);
  const warehouses = await warehouseInputs(db, demand.map((d) => d.productId));
  return { demand, warehouses, stockable, result: planSplit(demand, warehouses) };
}

/** Order status derived from shipments vs demand. */
export function deriveOrderStatus(
  order: OrderDetail,
  shipmentCount: number,
  stockable?: Set<string>,
): "CONFIRMED" | "IN_FULFILLMENT" | "PARTIALLY_SHIPPED" | "COMPLETED" {
  if (shipmentCount === 0) return "CONFIRMED";
  const remaining = outstandingDemand(order, stockable);
  if (remaining.length > 0) return "PARTIALLY_SHIPPED";
  const allDelivered = order.shipments.length > 0 && order.shipments.every((s) => s.status === "DELIVERED");
  return allDelivered ? "COMPLETED" : "IN_FULFILLMENT";
}

/** Same as `deriveOrderStatus`, resolving the stockable set from the database first. */
export async function deriveOrderStatusFor(db: Db, order: OrderDetail, shipmentCount: number) {
  const stockable = await stockableProductIds(db, oneTimeProductIds(order));
  return deriveOrderStatus(order, shipmentCount, stockable);
}
