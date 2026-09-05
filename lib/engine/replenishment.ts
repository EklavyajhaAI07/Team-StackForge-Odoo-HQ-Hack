// §A4 Replenishment rules. Pure: stock levels in, restocking decisions out. No database calls.
//
// The rule is deliberately the simple one real warehouses start with: each warehouse holds a
// reorder point per product, and when the level reaches it that line needs restocking. A
// reorder point of 0 means the rule is switched off for that line, which is the default so
// that adding the field changes nothing until someone configures it.

export type StockLevel = {
  warehouseId: string;
  productId: string;
  qty: number;
  /** At or below this level the line needs restocking. 0 disables the rule for this line. */
  reorderPoint: number;
};

export type ReplenishmentFlag = {
  warehouseId: string;
  productId: string;
  qty: number;
  reorderPoint: number;
  /** How far under the reorder point the line has fallen. 0 when it is sitting exactly on it. */
  shortfall: number;
  /** Units to order to reach the target level. Always at least 1 when flagged. */
  suggestedOrderQty: number;
  /** True when there is nothing left at all, which is the urgent case. */
  outOfStock: boolean;
};

// DECISION: with no separate "max level" field to configure, the target is twice the reorder
// point — the usual textbook default, which keeps roughly one reorder point of buffer above
// the trigger so the line does not immediately flag again after a delivery.
export const RESTOCK_TARGET_MULTIPLE = 2;

/** Is this line at or below its reorder point? */
export function needsRestock(level: StockLevel): boolean {
  return level.reorderPoint > 0 && level.qty <= level.reorderPoint;
}

function flag(level: StockLevel): ReplenishmentFlag {
  const target = level.reorderPoint * RESTOCK_TARGET_MULTIPLE;
  return {
    warehouseId: level.warehouseId,
    productId: level.productId,
    qty: level.qty,
    reorderPoint: level.reorderPoint,
    shortfall: Math.max(0, level.reorderPoint - level.qty),
    suggestedOrderQty: Math.max(1, target - level.qty),
    outOfStock: level.qty <= 0,
  };
}

/**
 * Every line that needs restocking, worst first: empty shelves before merely low ones, then
 * by how far under the reorder point they have fallen.
 */
export function belowReorderPoint(levels: StockLevel[]): ReplenishmentFlag[] {
  return levels
    .filter(needsRestock)
    .map(flag)
    .sort((a, b) => Number(b.outOfStock) - Number(a.outOfStock) || b.shortfall - a.shortfall);
}

/**
 * Lines that were fine before and are not any more.
 *
 * This is what makes the rule act rather than just describe: fulfilling an order draws stock
 * down, and the warehouse wants to hear about the lines that crossed the threshold on this
 * shipment — not the whole standing list of low items it already knows about.
 */
export function crossedBelowReorderPoint(before: StockLevel[], after: StockLevel[]): ReplenishmentFlag[] {
  const was = new Map(before.map((l) => [`${l.warehouseId}:${l.productId}`, l]));
  return after
    .filter((level) => {
      if (!needsRestock(level)) return false;
      const previous = was.get(`${level.warehouseId}:${level.productId}`);
      // Unknown before means newly created at a low level — worth reporting.
      return !previous || !needsRestock(previous);
    })
    .map(flag)
    .sort((a, b) => Number(b.outOfStock) - Number(a.outOfStock) || b.shortfall - a.shortfall);
}
