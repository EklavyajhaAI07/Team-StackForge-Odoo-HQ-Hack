// Billing domain service: recurring invoice generation, proration, cancellation and payments.
// It deliberately uses the canonical schema: Invoice(kind), BillingEntry and Payment.
import { prisma, type Tx } from "@/lib/db";
import { ApiError } from "@/lib/api";
import { logAudit, type AuditActor } from "@/lib/audit";
import { currentCycle, prorateCancel, prorateQtyChange, type Interval, type ProrationResult } from "@/lib/engine/proration";
import { orderDetailInclude, type OrderDetail } from "./order";

type Db = Tx | typeof prisma;
type RecurringLine = OrderDetail["quotation"]["lines"][number];

const DUE_DAYS = 30;

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

function requireValidChangeDate(value: Date): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new ApiError(400, "Choose a valid effective date");
  if (date.getTime() > Date.now() + 60_000) throw new ApiError(400, "An effective date cannot be in the future");
  return date;
}

function netUnit(line: RecurringLine): number {
  return Math.round(line.unitPrice * (1 - line.discountPct / 100));
}

function taxFor(netAmount: number, taxPct: number): number {
  return Math.round((netAmount * taxPct) / 100);
}

/** Engine guards throw plain Errors; surface them as "fix this input", never as a server fault. */
function fromEngine<T>(run: () => T): T {
  try {
    return run();
  } catch (err) {
    throw new ApiError(400, err instanceof Error ? err.message : "That proration could not be calculated");
  }
}

async function requireOrder(db: Db, orderId: string): Promise<OrderDetail> {
  const order = await db.order.findUnique({ where: { id: orderId }, include: orderDetailInclude });
  if (!order) throw new ApiError(404, "Order not found");
  return order;
}

function requireRecurringLine(order: OrderDetail, lineId: string): RecurringLine {
  const line = order.quotation.lines.find((candidate) => candidate.id === lineId);
  if (!line) throw new ApiError(404, "Subscription line not found on this order");
  if (!line.isRecurring) throw new ApiError(400, "Only subscription lines can be billed this way");
  if (!line.plan) throw new ApiError(409, "This subscription line has no billing plan");
  return line;
}

function billingContext(order: OrderDetail, line: RecurringLine, effectiveAt: Date) {
  const anchor = order.schedule.find((entry) => entry.lineId === line.id)?.billOn;
  if (!anchor) throw new ApiError(409, "This subscription has no billing schedule");
  // The screen supplies a date, while the anchor carries the confirmation time. A change dated the
  // day the order was confirmed is therefore "before" the anchor by a few hours; it belongs to the
  // first cycle, so clamp rather than reject.
  const at = effectiveAt < anchor ? anchor : effectiveAt;
  const cycle = fromEngine(() => currentCycle(anchor, line.plan!.interval as Interval, at));
  return { cycle, netUnit: netUnit(line), cancelRule: line.plan!.cancelRule };
}

export type QuantityChangePreview = {
  line: { id: string; name: string; currentQty: number; newQty: number; planName: string };
  cycle: { start: Date; end: Date; periodDays: number; remainingDays: number };
  result: ProrationResult;
};

/** Resolve a proration preview without changing data. */
export async function previewQuantityChange(
  db: Db,
  orderId: string,
  lineId: string,
  newQty: number,
  effectiveAt: Date,
): Promise<QuantityChangePreview> {
  if (!Number.isInteger(newQty) || newQty < 0) throw new ApiError(400, "New quantity must be a whole number of zero or more");
  const changeAt = requireValidChangeDate(effectiveAt);
  const order = await requireOrder(db, orderId);
  const line = requireRecurringLine(order, lineId);
  if (line.qty === 0) throw new ApiError(409, "This subscription line is already cancelled");
  const { cycle, netUnit: unit, cancelRule } = billingContext(order, line, changeAt);
  const result = fromEngine(() => prorateQtyChange({
    oldQty: line.qty,
    newQty,
    netUnit: unit,
    periodDays: cycle.periodDays,
    remainingDays: cycle.remainingDays,
    cancelRule,
  }));
  return {
    line: { id: line.id, name: line.product.name, currentQty: line.qty, newQty, planName: line.plan!.name },
    cycle,
    result,
  };
}

/** Persist a reviewed quantity change, create any proration document and revise future schedule rows. */
export async function applyQuantityChange(
  tx: Db,
  input: { orderId: string; lineId: string; newQty: number; effectiveAt: Date; actor: AuditActor },
) {
  const preview = await previewQuantityChange(tx, input.orderId, input.lineId, input.newQty, input.effectiveAt);
  const order = await requireOrder(tx, input.orderId);
  const line = requireRecurringLine(order, input.lineId);
  const { result, cycle } = preview;

  let invoice: { id: string; kind: string; amount: number; tax: number } | null = null;
  if (result.kind !== "NONE") {
    const created = await tx.invoice.create({
      data: {
        orderId: order.id,
        kind: result.kind === "INVOICE" ? "RECURRING" : "CREDIT_NOTE",
        amount: result.amount,
        tax: taxFor(result.amount, line.product.taxPct),
        status: "POSTED",
        dueDate: result.kind === "INVOICE" ? addDays(new Date(), DUE_DAYS) : null,
      },
      select: { id: true, kind: true, amount: true, tax: true },
    });
    invoice = created;
  }

  await tx.quotationLine.update({ where: { id: line.id }, data: { qty: input.newQty } });
  await tx.billingEntry.updateMany({
    where: { orderId: order.id, lineId: line.id, status: "SCHEDULED", billOn: { gte: cycle.end } },
    data: { amount: result.newCycleAmount },
  });

  await logAudit(
    tx,
    {
      entityType: "Order",
      entityId: order.id,
      actor: input.actor,
      action: "qty-changed",
      meta: {
        product: line.product.name,
        qty: { from: line.qty, to: input.newQty },
        kind: result.kind,
        amount: result.amount,
        periodDays: result.periodDays,
        remainingDays: result.remainingDays,
        futureCycleAmount: result.newCycleAmount,
      },
    },
    order.quotationId,
  );

  return { quotationId: order.quotationId, preview, invoice };
}

export type CancellationPreview = {
  line: { id: string; name: string; qty: number; planName: string; cancelRule: string };
  cycle: { start: Date; end: Date; periodDays: number; remainingDays: number };
  result: ProrationResult;
};

/** Resolve the cancellation credit-note preview without changing data. */
export async function previewCancellation(db: Db, orderId: string, lineId: string, effectiveAt: Date): Promise<CancellationPreview> {
  const changeAt = requireValidChangeDate(effectiveAt);
  const order = await requireOrder(db, orderId);
  const line = requireRecurringLine(order, lineId);
  if (line.qty === 0) throw new ApiError(409, "This subscription line is already cancelled");
  const { cycle, netUnit: unit, cancelRule } = billingContext(order, line, changeAt);
  const result = fromEngine(() => prorateCancel({ qty: line.qty, netUnit: unit, periodDays: cycle.periodDays, remainingDays: cycle.remainingDays, cancelRule }));
  return {
    line: { id: line.id, name: line.product.name, qty: line.qty, planName: line.plan!.name, cancelRule },
    cycle,
    result,
  };
}

/** Cancel one subscription line, remove future scheduled rows, and issue a credit note where policy permits. */
export async function cancelSubscription(
  tx: Db,
  input: { orderId: string; lineId: string; effectiveAt: Date; actor: AuditActor },
) {
  const preview = await previewCancellation(tx, input.orderId, input.lineId, input.effectiveAt);
  const order = await requireOrder(tx, input.orderId);
  const line = requireRecurringLine(order, input.lineId);
  let creditNote: { id: string; amount: number; tax: number } | null = null;
  if (preview.result.kind === "CREDIT_NOTE") {
    creditNote = await tx.invoice.create({
      data: {
        orderId: order.id,
        kind: "CREDIT_NOTE",
        amount: preview.result.amount,
        tax: taxFor(preview.result.amount, line.product.taxPct),
        status: "POSTED",
      },
      select: { id: true, amount: true, tax: true },
    });
  }

  await tx.quotationLine.update({ where: { id: line.id }, data: { qty: 0 } });
  const removed = await tx.billingEntry.deleteMany({
    where: { orderId: order.id, lineId: line.id, status: "SCHEDULED", billOn: { gte: preview.cycle.end } },
  });
  await logAudit(
    tx,
    {
      entityType: "Order",
      entityId: order.id,
      actor: input.actor,
      action: "subscription-cancelled",
      meta: {
        product: line.product.name,
        qty: line.qty,
        amount: preview.result.amount,
        kind: preview.result.kind,
        removedFutureEntries: removed.count,
        remainingDays: preview.result.remainingDays,
        periodDays: preview.result.periodDays,
      },
    },
    order.quotationId,
  );
  return { quotationId: order.quotationId, preview, creditNote, removedFutureEntries: removed.count };
}

/** Turn a due BillingEntry into a posted recurring invoice exactly once. */
export async function generateRecurringInvoice(tx: Db, input: { orderId: string; entryId: string; actor: AuditActor }) {
  const order = await requireOrder(tx, input.orderId);
  const entry = order.schedule.find((candidate) => candidate.id === input.entryId);
  if (!entry) throw new ApiError(404, "Billing entry not found on this order");
  if (entry.status !== "SCHEDULED") throw new ApiError(409, "This billing entry has already been invoiced");
  if (entry.billOn.getTime() > Date.now()) throw new ApiError(409, "This billing entry is not due yet");
  const line = requireRecurringLine(order, entry.lineId);
  if (line.qty === 0) throw new ApiError(409, "This subscription line is cancelled");

  const invoice = await tx.invoice.create({
    data: {
      orderId: order.id,
      kind: "RECURRING",
      amount: entry.amount,
      tax: taxFor(entry.amount, line.product.taxPct),
      status: "POSTED",
      dueDate: addDays(new Date(), DUE_DAYS),
    },
    select: { id: true, amount: true, tax: true, dueDate: true },
  });
  await tx.billingEntry.update({ where: { id: entry.id }, data: { status: "INVOICED" } });
  await logAudit(
    tx,
    {
      entityType: "Order",
      entityId: order.id,
      actor: input.actor,
      action: "invoice-generated",
      meta: { product: line.product.name, amount: entry.amount, billOn: entry.billOn.toISOString(), invoiceId: invoice.id },
    },
    order.quotationId,
  );
  return { quotationId: order.quotationId, invoice, entryId: entry.id };
}

/** Record a payment. Partial payments stay POSTED; paying the inclusive total marks the invoice PAID. */
export async function recordPayment(
  tx: Db,
  input: { orderId: string; invoiceId: string; amount: number; method: string; actor: AuditActor },
) {
  if (!Number.isInteger(input.amount) || input.amount <= 0) throw new ApiError(400, "Payment amount must be a positive whole number of paise");
  if (!input.method.trim()) throw new ApiError(400, "Choose a payment method");

  const order = await requireOrder(tx, input.orderId);
  const invoice = order.invoices.find((candidate) => candidate.id === input.invoiceId);
  if (!invoice) throw new ApiError(404, "Invoice not found on this order");
  if (invoice.kind === "CREDIT_NOTE") throw new ApiError(400, "Credit notes cannot receive payments");
  if (invoice.status !== "POSTED") throw new ApiError(409, "Only posted invoices can receive payments");

  const inclusiveTotal = invoice.amount + invoice.tax;
  const paid = invoice.payments.reduce((sum, payment) => sum + payment.amount, 0);
  const outstanding = inclusiveTotal - paid;
  if (outstanding <= 0) throw new ApiError(409, "This invoice is already paid");
  if (input.amount > outstanding) throw new ApiError(400, `Payment exceeds the ${outstanding} paise outstanding balance`);

  const payment = await tx.payment.create({ data: { invoiceId: invoice.id, amount: input.amount, method: input.method.trim() } });
  const remaining = outstanding - input.amount;
  if (remaining === 0) await tx.invoice.update({ where: { id: invoice.id }, data: { status: "PAID" } });

  await logAudit(
    tx,
    {
      entityType: "Order",
      entityId: order.id,
      actor: input.actor,
      action: "payment-recorded",
      meta: { amount: input.amount, method: input.method.trim(), invoiceId: invoice.id, outstandingAfter: remaining },
    },
    order.quotationId,
  );
  return { quotationId: order.quotationId, payment, status: remaining === 0 ? "PAID" : "POSTED", outstandingAfter: remaining };
}
