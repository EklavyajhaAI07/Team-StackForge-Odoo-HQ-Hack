// §5.1 Risk score — pure. The caller resolves prices/ceilings from the DB and passes plain numbers.

export type RiskLineInput = {
  lineId: string;
  name?: string;
  qty: number;
  /** Discount the rep has given on this line, in percent (12.5 = 12.5%). */
  discountPct: number;
  /** Effective list price in paise: PriceListItem(tier) ?? listPrice (+ variant extraPrice). */
  effectiveList: number;
  /** Unit cost in paise. */
  cost: number;
  /** DiscountPolicy(tier, category).ceilingPct */
  ceilingPct: number;
};

export type RiskPerLine = {
  lineId: string;
  name?: string;
  ceiling: number;
  overage: number;
  discountPct: number;
};

export type RiskResult = {
  /** Revenue-weighted overage points across all lines. */
  blended: number;
  /** Largest single-line overage in points. */
  maxLineOverage: number;
  perLine: RiskPerLine[];
  /** Live gross margin % on net revenue. 0 for an empty cart. */
  marginPct: number;
  /** Σ netUnit × qty (paise, excl. tax). */
  netTotal: number;
  /** Σ effectiveList × qty (paise) — the "before discount" figure. */
  listTotal: number;
};

/** effectiveList(line) = PriceListItem(customer.tier, product) ?? product.listPrice (+ variant.extraPrice) */
export function effectiveListPrice(input: {
  listPrice: number;
  tierPrice?: number | null;
  variantExtra?: number | null;
}): number {
  return (input.tierPrice ?? input.listPrice) + (input.variantExtra ?? 0);
}

export function lineOverage(discountPct: number, ceilingPct: number): number {
  return Math.max(0, discountPct - ceilingPct);
}

export function computeRisk(lines: RiskLineInput[]): RiskResult {
  let weightSum = 0;
  let weightedOverage = 0;
  let maxLineOverage = 0;
  let netRevenue = 0;
  let grossProfit = 0;
  let listTotal = 0;
  const perLine: RiskPerLine[] = [];

  for (const line of lines) {
    const overage = lineOverage(line.discountPct, line.ceilingPct);
    const weight = line.qty * line.effectiveList;
    const netUnit = line.effectiveList * (1 - line.discountPct / 100);

    weightSum += weight;
    weightedOverage += overage * weight;
    maxLineOverage = Math.max(maxLineOverage, overage);
    netRevenue += netUnit * line.qty;
    grossProfit += (netUnit - line.cost) * line.qty;
    listTotal += weight;

    perLine.push({
      lineId: line.lineId,
      name: line.name,
      ceiling: line.ceilingPct,
      overage: round2(overage),
      discountPct: line.discountPct,
    });
  }

  const blended = weightSum > 0 ? weightedOverage / weightSum : 0;
  const marginPct = netRevenue > 0 ? (grossProfit / netRevenue) * 100 : 0;

  return {
    blended: round2(blended),
    maxLineOverage: round2(maxLineOverage),
    perLine,
    marginPct: round2(marginPct),
    netTotal: Math.round(netRevenue),
    listTotal: Math.round(listTotal),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
