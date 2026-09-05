// §5.7 Upsell — co-purchase counts learned from HistoricalOrder.productIds. Pure.

// DECISION: candidates whose margin is below this are never suggested — no point upselling a loss-leader.
export const MIN_UPSELL_MARGIN_PCT = 15;

export type UpsellCandidateProduct = {
  id: string;
  name: string;
  isPromoted: boolean;
  cost: number;
  /** Net unit price the customer would pay (effective list at 0% discount), paise. */
  netUnit: number;
};

export type UpsellSuggestion = {
  productId: string;
  name: string;
  isPromoted: boolean;
  coCount: number;
  score: number;
  marginDelta: number; // netUnit − cost for qty 1, paise
  marginPct: number;
  /** Names of cart items it was bought with most often — for copy like "Often bought with ProBook 14". */
  because: string[];
};

export function coPurchaseCounts(
  cartProductIds: string[],
  history: { productIds: string[] }[],
): Map<string, { count: number; with: Map<string, number> }> {
  const cart = new Set(cartProductIds);
  const counts = new Map<string, { count: number; with: Map<string, number> }>();
  for (const order of history) {
    const ids = new Set(order.productIds);
    const overlap = [...ids].filter((id) => cart.has(id));
    if (overlap.length === 0) continue;
    for (const id of ids) {
      if (cart.has(id)) continue;
      const entry = counts.get(id) ?? { count: 0, with: new Map() };
      entry.count += 1;
      for (const o of overlap) entry.with.set(o, (entry.with.get(o) ?? 0) + 1);
      counts.set(id, entry);
    }
  }
  return counts;
}

export function suggestUpsells(input: {
  cartProductIds: string[];
  history: { productIds: string[] }[];
  products: UpsellCandidateProduct[];
  productNames?: Record<string, string>;
  limit?: number;
  minMarginPct?: number;
}): UpsellSuggestion[] {
  const limit = input.limit ?? 5;
  const minMargin = input.minMarginPct ?? MIN_UPSELL_MARGIN_PCT;
  const counts = coPurchaseCounts(input.cartProductIds, input.history);
  const byId = new Map(input.products.map((p) => [p.id, p]));
  const out: UpsellSuggestion[] = [];

  for (const [productId, entry] of counts) {
    const p = byId.get(productId);
    if (!p) continue;
    const marginDelta = p.netUnit - p.cost;
    const marginPct = p.netUnit > 0 ? (marginDelta / p.netUnit) * 100 : 0;
    if (marginPct < minMargin) continue;
    const score = entry.count * (p.isPromoted ? 1.5 : 1);
    const because = [...entry.with.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([id]) => input.productNames?.[id] ?? id);
    out.push({
      productId,
      name: p.name,
      isPromoted: p.isPromoted,
      coCount: entry.count,
      score,
      marginDelta,
      marginPct: Math.round(marginPct * 10) / 10,
      because,
    });
  }

  out.sort((a, b) => b.score - a.score || b.marginDelta - a.marginDelta || a.name.localeCompare(b.name));
  return out.slice(0, limit);
}

/** Ranked co-purchase pairs across all history — for the read-only backend "learned from order history" table. */
export function learnedPairs(
  history: { productIds: string[] }[],
  names: Record<string, string>,
  limit = 25,
): { a: string; b: string; aName: string; bName: string; count: number }[] {
  const pairs = new Map<string, number>();
  for (const order of history) {
    const ids = [...new Set(order.productIds)].sort();
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const key = `${ids[i]}|${ids[j]}`;
        pairs.set(key, (pairs.get(key) ?? 0) + 1);
      }
    }
  }
  return [...pairs.entries()]
    .map(([key, count]) => {
      const [a, b] = key.split("|");
      return { a, b, aName: names[a] ?? a, bName: names[b] ?? b, count };
    })
    .sort((x, y) => y.count - x.count || x.aName.localeCompare(y.aName))
    .slice(0, limit);
}
