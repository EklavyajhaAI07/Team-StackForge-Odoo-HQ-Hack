// §5.4 Hybrid billing & proration — pure date/money math. All amounts in paise.

export type Interval = "MONTHLY" | "QUARTERLY" | "YEARLY";
export type CancelRule = "PRORATED_CREDIT" | "NO_REFUND";

const DAY = 86_400_000;

/** Whole days between two instants (UTC midnight to UTC midnight). */
export function daysBetween(from: Date, to: Date): number {
  return Math.round((utcMidnight(to) - utcMidnight(from)) / DAY);
}

function utcMidnight(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export function addInterval(date: Date, interval: Interval, times = 1): Date {
  const d = new Date(date.getTime());
  const months = interval === "MONTHLY" ? 1 : interval === "QUARTERLY" ? 3 : 12;
  d.setUTCMonth(d.getUTCMonth() + months * times);
  return d;
}

/** Schedule of the next `cycles` billing dates starting at `anchor` (the confirm date). */
export function buildSchedule(input: {
  anchor: Date;
  interval: Interval;
  cycles: number;
  amountPerCycle: number;
}): { billOn: Date; amount: number }[] {
  const out: { billOn: Date; amount: number }[] = [];
  for (let i = 0; i < input.cycles; i++) {
    out.push({ billOn: addInterval(input.anchor, input.interval, i), amount: Math.round(input.amountPerCycle) });
  }
  return out;
}

/** The cycle that contains `at`, anchored on `anchor`. */
export function currentCycle(
  anchor: Date,
  interval: Interval,
  at: Date,
): { start: Date; end: Date; periodDays: number; remainingDays: number; index: number } {
  let index = 0;
  let start = new Date(anchor.getTime());
  let end = addInterval(anchor, interval, 1);
  // Walk forward until the cycle contains `at` (bounded; 3-cycle schedules never need more).
  while (at >= end && index < 1200) {
    index += 1;
    start = addInterval(anchor, interval, index);
    end = addInterval(anchor, interval, index + 1);
  }
  const periodDays = daysBetween(start, end);
  const remainingDays = Math.max(0, Math.min(periodDays, daysBetween(at, end)));
  return { start, end, periodDays, remainingDays, index };
}

export type ProrationResult = {
  /** Positive = charge customer, negative = credit customer, 0 = nothing. */
  delta: number;
  kind: "INVOICE" | "CREDIT_NOTE" | "NONE";
  amount: number;
  periodDays: number;
  remainingDays: number;
  /** Per-cycle amount at the new quantity (for future entries). */
  newCycleAmount: number;
  explanation: string;
};

/**
 * Mid-cycle quantity change:
 *   deltaCharge = (newQty − oldQty) × netUnit × remaining/periodDays
 * Positive → prorated RECURRING invoice. Negative → CREDIT_NOTE only under PRORATED_CREDIT.
 */
export function prorateQtyChange(input: {
  oldQty: number;
  newQty: number;
  netUnit: number;
  periodDays: number;
  remainingDays: number;
  cancelRule: CancelRule;
}): ProrationResult {
  const { oldQty, newQty, netUnit, periodDays, remainingDays, cancelRule } = input;
  const fraction = periodDays > 0 ? remainingDays / periodDays : 0;
  const raw = (newQty - oldQty) * netUnit * fraction;
  const delta = Math.round(raw);
  const newCycleAmount = Math.round(newQty * netUnit);

  if (delta > 0) {
    return {
      delta,
      kind: "INVOICE",
      amount: delta,
      periodDays,
      remainingDays,
      newCycleAmount,
      explanation: `Charge for ${newQty - oldQty} extra × ${remainingDays} of ${periodDays} remaining days`,
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
      explanation: `Credit for ${oldQty - newQty} fewer × ${remainingDays} of ${periodDays} remaining days`,
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
        ? "Plan is no-refund: no credit for the current cycle; future cycles bill at the new quantity"
        : "No change to the current cycle",
  };
}

/**
 * Cancel a subscription line:
 *   PRORATED_CREDIT → credit note qty × netUnit × remaining/periodDays, future entries removed
 *   NO_REFUND       → future entries removed only
 */
export function prorateCancel(input: {
  qty: number;
  netUnit: number;
  periodDays: number;
  remainingDays: number;
  cancelRule: CancelRule;
}): ProrationResult {
  const { qty, netUnit, periodDays, remainingDays, cancelRule } = input;
  const fraction = periodDays > 0 ? remainingDays / periodDays : 0;
  const credit = Math.round(qty * netUnit * fraction);
  if (cancelRule === "PRORATED_CREDIT" && credit > 0) {
    return {
      delta: -credit,
      kind: "CREDIT_NOTE",
      amount: credit,
      periodDays,
      remainingDays,
      newCycleAmount: 0,
      explanation: `Credit ${remainingDays} of ${periodDays} unused days; future cycles removed`,
    };
  }
  return {
    delta: 0,
    kind: "NONE",
    amount: 0,
    periodDays,
    remainingDays,
    newCycleAmount: 0,
    explanation: "Plan is no-refund: future cycles removed, current cycle stays billed",
  };
}
