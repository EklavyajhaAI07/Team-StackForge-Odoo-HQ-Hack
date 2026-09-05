// §5.4 Hybrid billing & proration — pure date/money math. All amounts are integer paise.

export type Interval = "MONTHLY" | "QUARTERLY" | "YEARLY";
export type CancelRule = "PRORATED_CREDIT" | "NO_REFUND";

const DAY = 86_400_000;

function validDate(value: Date, label: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`${label} must be a valid date`);
  return date;
}

function validWhole(value: number, label: string, minimum = 0): void {
  if (!Number.isInteger(value) || value < minimum) throw new Error(`${label} must be a whole number of at least ${minimum}`);
}

function validAmount(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${label} must be a non-negative amount`);
} 

function utcMidnight(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function daysInUtcMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

function intervalMonths(interval: Interval): number {
  return interval === "MONTHLY" ? 1 : interval === "QUARTERLY" ? 3 : 12;
}

/** Whole calendar days between two dates, evaluated at UTC midnight. */
export function daysBetween(from: Date, to: Date): number {
  const start = validDate(from, "Start date");
  const end = validDate(to, "End date");
  return Math.round((utcMidnight(end) - utcMidnight(start)) / DAY);
}

/**
 * Adds billing intervals while preserving the original day where possible.
 * 31 Jan + one month becomes 28/29 Feb, never 3 Mar.
 */
export function addInterval(date: Date, interval: Interval, times = 1): Date {
  const source = validDate(date, "Anchor date");
  if (!Number.isInteger(times)) throw new Error("Interval count must be a whole number");

  const monthIndex = source.getUTCFullYear() * 12 + source.getUTCMonth() + intervalMonths(interval) * times;
  const year = Math.floor(monthIndex / 12);
  const month = ((monthIndex % 12) + 12) % 12;
  const day = Math.min(source.getUTCDate(), daysInUtcMonth(year, month));
  return new Date(
    Date.UTC(year, month, day, source.getUTCHours(), source.getUTCMinutes(), source.getUTCSeconds(), source.getUTCMilliseconds()),
  );
}

/** Schedule of the next `cycles` billing dates, beginning at confirmation. */
export function buildSchedule(input: {
  anchor: Date;
  interval: Interval;
  cycles: number;
  amountPerCycle: number;
}): { billOn: Date; amount: number }[] {
  validDate(input.anchor, "Schedule anchor");
  validWhole(input.cycles, "Schedule cycles");
  validAmount(input.amountPerCycle, "Amount per cycle");

  return Array.from({ length: input.cycles }, (_, index) => ({
    billOn: addInterval(input.anchor, input.interval, index),
    amount: Math.round(input.amountPerCycle),
  }));
}

/** The billing cycle containing `at`, anchored on the first scheduled billing date. */
export function currentCycle(
  anchor: Date,
  interval: Interval,
  at: Date,
): { start: Date; end: Date; periodDays: number; remainingDays: number; index: number } {
  const first = validDate(anchor, "Schedule anchor");
  const changeAt = validDate(at, "Proration date");
  if (changeAt < first) throw new Error("Proration date cannot be before the subscription starts");

  let index = 0;
  let start = first;
  let end = addInterval(first, interval, 1);
  while (changeAt >= end && index < 1200) {
    index += 1;
    start = addInterval(first, interval, index);
    end = addInterval(first, interval, index + 1);
  }

  const periodDays = daysBetween(start, end);
  const remainingDays = Math.max(0, Math.min(periodDays, daysBetween(changeAt, end)));
  return { start, end, periodDays, remainingDays, index };
}

/** Compatibility-friendly date-based proration result for previews and direct engine use. */
export interface ProrationInput {
  currentQuantity: number;
  newQuantity: number;
  unitPrice: number;
  billingPeriodStart: Date;
  billingPeriodEnd: Date;
  prorationDate: Date;
}

export interface DateProrationResult {
  proratedCredit: number;
  proratedCharge: number;
  daysUsed: number;
  daysInPeriod: number;
  unusedDays: number;
}

/**
 * Date-based quantity proration. A period is `[start, end)`: a change on the end date
 * is valid but has no unused days. Quantity reductions are represented as a positive credit.
 */
export function calculateProration(input: ProrationInput): DateProrationResult {
  validWhole(input.currentQuantity, "Current quantity");
  validWhole(input.newQuantity, "New quantity");
  validAmount(input.unitPrice, "Unit price");
  const start = validDate(input.billingPeriodStart, "Billing period start");
  const end = validDate(input.billingPeriodEnd, "Billing period end");
  const change = validDate(input.prorationDate, "Proration date");
  if (end <= start) throw new Error("Billing period end must be after its start");
  if (change < start || change > end) throw new Error("Proration date must be within the billing period");

  const daysInPeriod = daysBetween(start, end);
  const daysUsed = Math.max(0, Math.min(daysInPeriod, daysBetween(start, change)));
  const unusedDays = daysInPeriod - daysUsed;
  const delta = input.newQuantity - input.currentQuantity;
  const amount = Math.round((Math.abs(delta) * input.unitPrice * unusedDays) / daysInPeriod);

  return {
    proratedCharge: delta > 0 ? amount : 0,
    proratedCredit: delta < 0 ? amount : 0,
    daysUsed,
    daysInPeriod,
    unusedDays,
  };
}

export type ProrationResult = {
  /** Positive = charge customer, negative = credit customer, 0 = nothing. */
  delta: number;
  kind: "INVOICE" | "CREDIT_NOTE" | "NONE";
  amount: number;
  periodDays: number;
  remainingDays: number;
  /** Per-cycle net amount at the new quantity, for future BillingEntry rows. */
  newCycleAmount: number;
  explanation: string;
};

function validateQuantityProration(input: {
  oldQty: number;
  newQty: number;
  netUnit: number;
  periodDays: number;
  remainingDays: number;
}): void {
  validWhole(input.oldQty, "Current quantity");
  validWhole(input.newQty, "New quantity");
  validAmount(input.netUnit, "Net unit price");
  validWhole(input.periodDays, "Period days", 1);
  validWhole(input.remainingDays, "Remaining days");
  if (input.remainingDays > input.periodDays) throw new Error("Remaining days cannot exceed the billing period");
}

/**
 * Mid-cycle quantity change:
 * `(newQty − oldQty) × netUnit × remaining / periodDays`.
 * A no-refund plan still updates future cycles, but never issues a current-cycle credit.
 */
export function prorateQtyChange(input: {
  oldQty: number;
  newQty: number;
  netUnit: number;
  periodDays: number;
  remainingDays: number;
  cancelRule: CancelRule;
}): ProrationResult {
  validateQuantityProration(input);
  const { oldQty, newQty, netUnit, periodDays, remainingDays, cancelRule } = input;
  const delta = Math.round(((newQty - oldQty) * netUnit * remainingDays) / periodDays);
  const newCycleAmount = Math.round(newQty * netUnit);

  if (delta > 0) {
    return {
      delta,
      kind: "INVOICE",
      amount: delta,
      periodDays,
      remainingDays,
      newCycleAmount,
      explanation: `Charge for ${newQty - oldQty} extra unit${newQty - oldQty === 1 ? "" : "s"} over ${remainingDays} of ${periodDays} remaining days`,
    };
  }
  if (delta < 0 && cancelRule === "PRORATED_CREDIT") {
    return {
      delta,
      kind: "CREDIT_NOTE",
      amount: Math.abs(delta),
      periodDays,
      remainingDays,
      newCycleAmount,
      explanation: `Credit for ${oldQty - newQty} removed unit${oldQty - newQty === 1 ? "" : "s"} over ${remainingDays} of ${periodDays} unused days`,
    };
  }
  return {
    delta: 0,
    kind: "NONE",
    amount: 0,
    periodDays,
    remainingDays,
    newCycleAmount,
    explanation:
      delta < 0
        ? "This plan is no-refund: future cycles update, while the current cycle stays billed"
        : "No change to the current cycle",
  };
}

/** Cancel a subscription line and calculate the optional prorated credit for its current cycle. */
export function prorateCancel(input: {
  qty: number;
  netUnit: number;
  periodDays: number;
  remainingDays: number;
  cancelRule: CancelRule;
}): ProrationResult {
  validWhole(input.qty, "Quantity");
  return prorateQtyChange({
    oldQty: input.qty,
    newQty: 0,
    netUnit: input.netUnit,
    periodDays: input.periodDays,
    remainingDays: input.remainingDays,
    cancelRule: input.cancelRule,
  });
}
