// §5.3 Warehouse split — greedy and explainable. Pure.

export type DemandLine = { productId: string; name?: string; qty: number };

export type WarehouseInput = {
  id: string;
  name: string;
  shippingCostWeight: number; // paise per shipment
  stock: Record<string, number>; // productId → qty on hand
};

export type PlannedShipment = {
  warehouseId: string;
  warehouseName: string;
  cost: number;
  lines: { productId: string; name?: string; qty: number }[];
};

export type SplitPlan = {
  key: string;
  label: string;
  shipments: PlannedShipment[];
  backorders: { productId: string; name?: string; qty: number }[];
  totalCost: number;
  shipsComplete: boolean;
  backorderedUnits: number;
  explanation: string[];
};

export type SplitResult = {
  plans: SplitPlan[]; // plans[0] is the recommendation
  recommended: SplitPlan;
};

export function formatCost(paise: number): string {
  return `₹${Math.round(paise / 100).toLocaleString("en-IN")}`;
}

function coverage(w: WarehouseInput, remaining: Map<string, number>): number {
  let units = 0;
  for (const [pid, qty] of remaining) units += Math.min(w.stock[pid] ?? 0, qty);
  return units;
}

function coversAll(w: WarehouseInput, demand: DemandLine[]): boolean {
  return demand.every((d) => (w.stock[d.productId] ?? 0) >= d.qty);
}

function nameOf(demand: DemandLine[], pid: string): string | undefined {
  return demand.find((d) => d.productId === pid)?.name;
}

function finish(
  key: string,
  shipments: PlannedShipment[],
  remaining: Map<string, number>,
  demand: DemandLine[],
  explanation: string[],
): SplitPlan {
  const backorders = [...remaining]
    .filter(([, q]) => q > 0)
    .map(([productId, qty]) => ({ productId, name: nameOf(demand, productId), qty }));
  const backorderedUnits = backorders.reduce((s, b) => s + b.qty, 0);
  const totalCost = shipments.reduce((s, sh) => s + sh.cost, 0);
  const n = shipments.length;
  const head = `${n} shipment${n === 1 ? "" : "s"} — ${formatCost(totalCost)}`;
  const tail =
    backorderedUnits === 0
      ? "ships complete"
      : `${backorderedUnits} unit${backorderedUnits === 1 ? "" : "s"} backordered`;
  return {
    key,
    label: `${head}, ${tail}`,
    shipments,
    backorders,
    totalCost,
    shipsComplete: backorderedUnits === 0,
    backorderedUnits,
    explanation,
  };
}

/** Greedy: repeatedly take the warehouse with the best coverage of what is still needed (ties → cheaper). */
function greedyPlan(demand: DemandLine[], warehouses: WarehouseInput[]): SplitPlan {
  const remaining = new Map(demand.map((d) => [d.productId, d.qty]));
  const used = new Set<string>();
  const shipments: PlannedShipment[] = [];
  const explanation: string[] = [];

  while ([...remaining.values()].some((q) => q > 0)) {
    const candidates = warehouses
      .filter((w) => !used.has(w.id))
      .map((w) => ({ w, cov: coverage(w, remaining) }))
      .filter((c) => c.cov > 0)
      .sort((a, b) => b.cov - a.cov || a.w.shippingCostWeight - b.w.shippingCostWeight);
    if (candidates.length === 0) break;
    const { w, cov } = candidates[0];
    used.add(w.id);
    const lines: PlannedShipment["lines"] = [];
    for (const [pid, qty] of remaining) {
      if (qty <= 0) continue;
      const take = Math.min(w.stock[pid] ?? 0, qty);
      if (take > 0) {
        lines.push({ productId: pid, name: nameOf(demand, pid), qty: take });
        remaining.set(pid, qty - take);
      }
    }
    shipments.push({ warehouseId: w.id, warehouseName: w.name, cost: w.shippingCostWeight, lines });
    explanation.push(`${w.name} covers ${cov} of the remaining units at ${formatCost(w.shippingCostWeight)}`);
  }
  const plan = finish("greedy", shipments, remaining, demand, explanation);
  if (!plan.shipsComplete) explanation.push(`No warehouse can supply the remainder — ${plan.backorderedUnits} units go to backorder`);
  return plan;
}

/** Single warehouse with the best coverage (then cheapest); the rest is backordered. */
function singleBestPlan(demand: DemandLine[], warehouses: WarehouseInput[]): SplitPlan | null {
  const remaining = new Map(demand.map((d) => [d.productId, d.qty]));
  const ranked = warehouses
    .map((w) => ({ w, cov: coverage(w, remaining) }))
    .filter((c) => c.cov > 0)
    .sort((a, b) => b.cov - a.cov || a.w.shippingCostWeight - b.w.shippingCostWeight);
  if (ranked.length === 0) return null;
  const { w, cov } = ranked[0];
  const lines: PlannedShipment["lines"] = [];
  for (const [pid, qty] of remaining) {
    const take = Math.min(w.stock[pid] ?? 0, qty);
    if (take > 0) {
      lines.push({ productId: pid, name: nameOf(demand, pid), qty: take });
      remaining.set(pid, qty - take);
    }
  }
  return finish(
    "single",
    [{ warehouseId: w.id, warehouseName: w.name, cost: w.shippingCostWeight, lines }],
    remaining,
    demand,
    [`${w.name} alone covers ${cov} units at ${formatCost(w.shippingCostWeight)}; everything else waits for stock`],
  );
}

function rankPlans(a: SplitPlan, b: SplitPlan): number {
  if (a.shipsComplete !== b.shipsComplete) return a.shipsComplete ? -1 : 1;
  if (a.backorderedUnits !== b.backorderedUnits) return a.backorderedUnits - b.backorderedUnits;
  if (a.totalCost !== b.totalCost) return a.totalCost - b.totalCost;
  return a.shipments.length - b.shipments.length;
}

/**
 * Returns the recommended plan first plus the best distinct alternative, so the UI can compare
 * e.g. "2 shipments — ₹1,010, ships complete" vs "1 shipment — ₹400, 4 units backordered".
 */
export function planSplit(demand: DemandLine[], warehouses: WarehouseInput[]): SplitResult {
  const positive = demand.filter((d) => d.qty > 0);
  if (positive.length === 0) {
    const empty = finish("none", [], new Map(), [], ["Nothing to ship"]);
    return { plans: [empty], recommended: empty };
  }

  const candidates: SplitPlan[] = [];

  // 1. A single warehouse that covers everything → cheapest one is Plan A.
  const full = warehouses.filter((w) => coversAll(w, positive)).sort((a, b) => a.shippingCostWeight - b.shippingCostWeight);
  if (full.length > 0) {
    const w = full[0];
    const remaining = new Map<string, number>();
    candidates.push(
      finish(
        "single-complete",
        [
          {
            warehouseId: w.id,
            warehouseName: w.name,
            cost: w.shippingCostWeight,
            lines: positive.map((d) => ({ productId: d.productId, name: d.name, qty: d.qty })),
          },
        ],
        remaining,
        positive,
        [`${w.name} has stock for every line; it is the cheapest complete option at ${formatCost(w.shippingCostWeight)}`],
      ),
    );
    // Alternative: next cheapest complete warehouse, if any.
    if (full.length > 1) {
      const alt = full[1];
      candidates.push(
        finish(
          "single-complete-alt",
          [
            {
              warehouseId: alt.id,
              warehouseName: alt.name,
              cost: alt.shippingCostWeight,
              lines: positive.map((d) => ({ productId: d.productId, name: d.name, qty: d.qty })),
            },
          ],
          new Map(),
          positive,
          [`${alt.name} also covers everything, at ${formatCost(alt.shippingCostWeight)}`],
        ),
      );
    }
  }

  // 2. Greedy multi-warehouse plan.
  candidates.push(greedyPlan(positive, warehouses));

  // 3. Single-best + backorder alternative.
  const single = singleBestPlan(positive, warehouses);
  if (single) candidates.push(single);

  // De-duplicate identical plans (same shipments & backorders), rank, keep two.
  const seen = new Set<string>();
  const unique = candidates.filter((p) => {
    const sig = JSON.stringify([p.shipments.map((s) => [s.warehouseId, s.lines]), p.backorders]);
    if (seen.has(sig)) return false;
    seen.add(sig);
    return true;
  });
  unique.sort(rankPlans);
  const plans = unique.slice(0, 2);
  return { plans, recommended: plans[0] };
}

/** Validate a manual override: per-warehouse quantities must sum to ordered qty and not exceed stock. */
export function validateOverride(
  demand: DemandLine[],
  warehouses: WarehouseInput[],
  allocation: Record<string, Record<string, number>>, // warehouseId → productId → qty
): { ok: true; plan: SplitPlan } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const shipments: PlannedShipment[] = [];
  const assigned = new Map<string, number>();

  for (const w of warehouses) {
    const alloc = allocation[w.id];
    if (!alloc) continue;
    const lines: PlannedShipment["lines"] = [];
    for (const [pid, qtyRaw] of Object.entries(alloc)) {
      const qty = Number(qtyRaw) || 0;
      if (qty < 0) errors.push(`${w.name}: quantity for ${nameOf(demand, pid) ?? pid} cannot be negative`);
      if (qty === 0) continue;
      const onHand = w.stock[pid] ?? 0;
      if (qty > onHand) errors.push(`${w.name}: only ${onHand} × ${nameOf(demand, pid) ?? pid} on hand, ${qty} requested`);
      lines.push({ productId: pid, name: nameOf(demand, pid), qty });
      assigned.set(pid, (assigned.get(pid) ?? 0) + qty);
    }
    if (lines.length > 0) shipments.push({ warehouseId: w.id, warehouseName: w.name, cost: w.shippingCostWeight, lines });
  }

  const remaining = new Map<string, number>();
  for (const d of demand) {
    const got = assigned.get(d.productId) ?? 0;
    if (got > d.qty) errors.push(`${d.name ?? d.productId}: allocated ${got} but only ${d.qty} ordered`);
    remaining.set(d.productId, Math.max(0, d.qty - got));
  }
  if (errors.length) return { ok: false, errors };
  return { ok: true, plan: finish("manual", shipments, remaining, demand, ["Manual override"]) };
}
