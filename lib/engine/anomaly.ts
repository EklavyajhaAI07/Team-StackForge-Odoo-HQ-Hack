// §5.6 Deal health & anomalies — pure.

const DAY = 86_400_000;

export const STALLABLE_STATUSES = new Set(["SENT", "UNDER_NEGOTIATION", "PENDING_MANAGER", "PENDING_FINANCE"]);

export function isStalled(input: { status: string; lastActivityAt: Date; stalledDays: number; now?: Date }): boolean {
  if (!STALLABLE_STATUSES.has(input.status)) return false;
  const now = input.now ?? new Date();
  return now.getTime() - input.lastActivityAt.getTime() > input.stalledDays * DAY;
}

export function daysSince(date: Date, now: Date = new Date()): number {
  return Math.max(0, Math.floor((now.getTime() - date.getTime()) / DAY));
}

export function meanStd(values: number[]): { mean: number; std: number; n: number } {
  const n = values.length;
  if (n === 0) return { mean: 0, std: 0, n: 0 };
  const mean = values.reduce((s, v) => s + v, 0) / n;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
  return { mean, std: Math.sqrt(variance), n };
}

export type RepStats = { repId: string; mean: number; std: number; n: number };

export function repDiscountStats(history: { repId: string; orderDiscountPct: number }[]): Map<string, RepStats> {
  const byRep = new Map<string, number[]>();
  for (const h of history) {
    const arr = byRep.get(h.repId) ?? [];
    arr.push(h.orderDiscountPct);
    byRep.set(h.repId, arr);
  }
  const out = new Map<string, RepStats>();
  for (const [repId, values] of byRep) {
    const { mean, std, n } = meanStd(values);
    out.set(repId, { repId, mean, std, n });
  }
  return out;
}

export type AnomalyFlag = {
  quotationId: string;
  repId: string;
  quoteDiscountPct: number;
  repMean: number;
  repStd: number;
  threshold: number;
};

/**
 * Flag active quotes whose revenue-weighted average discount exceeds μ + sigma·σ for the rep (and > 5%).
 */
export function flagDiscountAnomalies(input: {
  quotes: { quotationId: string; repId: string; weightedAvgDiscount: number }[];
  history: { repId: string; orderDiscountPct: number }[];
  sigma: number;
  minPct?: number; // DECISION: hard floor so tiny σ never flags a 4% quote
}): AnomalyFlag[] {
  const minPct = input.minPct ?? 5;
  const stats = repDiscountStats(input.history);
  const flags: AnomalyFlag[] = [];
  for (const q of input.quotes) {
    const s = stats.get(q.repId);
    if (!s || s.n === 0) continue;
    const threshold = s.mean + input.sigma * s.std;
    if (q.weightedAvgDiscount > threshold && q.weightedAvgDiscount > minPct) {
      flags.push({
        quotationId: q.quotationId,
        repId: q.repId,
        quoteDiscountPct: q.weightedAvgDiscount,
        repMean: s.mean,
        repStd: s.std,
        threshold,
      });
    }
  }
  return flags;
}

/** Revenue-weighted average discount of a cart. */
export function weightedAvgDiscount(lines: { qty: number; unitPrice: number; discountPct: number }[]): number {
  let w = 0;
  let acc = 0;
  for (const l of lines) {
    const weight = l.qty * l.unitPrice;
    w += weight;
    acc += weight * l.discountPct;
  }
  return w > 0 ? acc / w : 0;
}

export function isSlipping(input: {
  promisedDate: Date | null | undefined;
  shipments: { status: string }[];
  now?: Date;
}): boolean {
  if (!input.promisedDate) return false;
  const now = input.now ?? new Date();
  if (input.promisedDate.getTime() >= now.getTime()) return false;
  return input.shipments.some((s) => s.status !== "DELIVERED");
}
