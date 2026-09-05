// Run: npm test   (node:test via tsx — no extra test framework)
import { test } from "node:test";
import assert from "node:assert/strict";
import { computeRisk, effectiveListPrice } from "./risk";
import { routeQuotation } from "./routing";
import { prorateQtyChange, prorateCancel, buildSchedule, currentCycle } from "./proration";
import { planSplit } from "./split";

// ── Risk (§5.1) ─────────────────────────────────────────────────────────────

test("risk: revenue-weighted blended score, max line overage and live margin", () => {
  // Line A: 10 × ₹62,000 at 20% vs 15% ceiling → 5 pts over, weight 620,000
  // Line B: 10 × ₹6,000 at 8%  vs 10% ceiling → 0 pts over, weight 60,000
  const r = computeRisk([
    { lineId: "a", qty: 10, discountPct: 20, effectiveList: 6_200_000, cost: 4_030_000, ceilingPct: 15 },
    { lineId: "b", qty: 10, discountPct: 8, effectiveList: 600_000, cost: 270_000, ceilingPct: 10 },
  ]);
  // blended = (5 × 62,000,000 + 0 × 6,000,000) / 68,000,000 = 4.5588 → 4.56
  assert.equal(r.blended, 4.56);
  assert.equal(r.maxLineOverage, 5);
  assert.deepEqual(
    r.perLine.map((p) => [p.lineId, p.ceiling, p.overage]),
    [
      ["a", 15, 5],
      ["b", 10, 0],
    ],
  );
  // net A = 10 × 49,600 = 496,000 ; profit A = 10 × (49,600 − 40,300) = 93,000
  // net B = 10 × 5,520  = 55,200  ; profit B = 10 × (5,520 − 2,700)   = 28,200
  // margin = 121,200 / 551,200 = 21.988% → 21.99
  assert.equal(r.marginPct, 21.99);
  assert.equal(r.netTotal, 55_120_000);
});

test("risk: effective list price = tier price ?? list price, plus variant extra", () => {
  assert.equal(effectiveListPrice({ listPrice: 100, tierPrice: 90, variantExtra: 5 }), 95);
  assert.equal(effectiveListPrice({ listPrice: 100, tierPrice: null }), 100);
  const r = computeRisk([]);
  assert.equal(r.blended, 0);
  assert.equal(r.marginPct, 0);
});

// ── Routing (§5.2) ──────────────────────────────────────────────────────────

test("routing: within policy auto-approves; small overage → manager; big overage → manager + finance", () => {
  const cfg = { managerBlendedMaxPts: 3, financeLineOveragePts: 5, financeAmountThreshold: 50_000_000 };
  assert.equal(routeQuotation({ blended: 0, maxLineOverage: 0, total: 1000 }, cfg).kind, "AUTO_APPROVED");
  assert.deepEqual(routeQuotation({ blended: 2.5, maxLineOverage: 4, total: 1000 }, cfg).steps, ["SALES_MANAGER"]);
  assert.deepEqual(routeQuotation({ blended: 2.5, maxLineOverage: 8, total: 1000 }, cfg).steps, [
    "SALES_MANAGER",
    "FINANCE",
  ]);
  // amount threshold alone pulls finance in
  assert.equal(routeQuotation({ blended: 1, maxLineOverage: 1, total: 50_000_000 }, cfg).kind, "MANAGER_FINANCE");
});

// ── Proration (§5.4) ────────────────────────────────────────────────────────

test("proration: mid-cycle qty increase charges (newQty − oldQty) × netUnit × remaining/periodDays", () => {
  // Monthly cycle anchored 1 Mar → 1 Apr = 31 days; change on 18 Mar → 14 days remain.
  const cycle = currentCycle(new Date("2026-03-01T00:00:00Z"), "MONTHLY", new Date("2026-03-18T09:00:00Z"));
  assert.equal(cycle.periodDays, 31);
  assert.equal(cycle.remainingDays, 14);
  const r = prorateQtyChange({
    oldQty: 10,
    newQty: 12,
    netUnit: 108_000, // ₹1,080 after 10% off ₹1,200
    periodDays: cycle.periodDays,
    remainingDays: cycle.remainingDays,
    cancelRule: "PRORATED_CREDIT",
  });
  // 2 × 108,000 × 14/31 = 97,548.39 → 97,548 paise (₹975.48)
  assert.equal(r.kind, "INVOICE");
  assert.equal(r.amount, 97_548);
  assert.equal(r.newCycleAmount, 1_296_000);
});

test("proration: decrease credits under PRORATED_CREDIT, nothing under NO_REFUND; cancel likewise", () => {
  const base = { oldQty: 10, newQty: 7, netUnit: 100_000, periodDays: 30, remainingDays: 15 };
  const credit = prorateQtyChange({ ...base, cancelRule: "PRORATED_CREDIT" });
  assert.equal(credit.kind, "CREDIT_NOTE");
  assert.equal(credit.amount, 150_000); // 3 × 100,000 × 0.5
  const none = prorateQtyChange({ ...base, cancelRule: "NO_REFUND" });
  assert.equal(none.kind, "NONE");

  const cancel = prorateCancel({ qty: 4, netUnit: 250_000, periodDays: 90, remainingDays: 45, cancelRule: "PRORATED_CREDIT" });
  assert.equal(cancel.amount, 500_000); // 4 × 250,000 × 0.5
  assert.equal(prorateCancel({ qty: 4, netUnit: 250_000, periodDays: 90, remainingDays: 45, cancelRule: "NO_REFUND" }).kind, "NONE");

  const sched = buildSchedule({ anchor: new Date("2026-01-31T00:00:00Z"), interval: "MONTHLY", cycles: 3, amountPerCycle: 1000 });
  assert.equal(sched.length, 3);
  assert.equal(sched[0].billOn.toISOString().slice(0, 10), "2026-01-31");
});

// ── Split (§5.3) ────────────────────────────────────────────────────────────

test("split: prefers a single complete warehouse, otherwise greedy multi-warehouse with a backorder alternative", () => {
  const warehouses = [
    { id: "main", name: "Main", shippingCostWeight: 40_000, stock: { lap: 6, ups: 10 } },
    { id: "east", name: "East", shippingCostWeight: 65_000, stock: { lap: 3, ups: 6 } },
    { id: "south", name: "South", shippingCostWeight: 56_000, stock: { lap: 8, ups: 12 } },
  ];
  // 10 laptops: no single warehouse covers → greedy South(8) + Main(2), alt South + 2 backordered
  const r = planSplit([{ productId: "lap", name: "Laptop", qty: 10 }], warehouses);
  assert.equal(r.recommended.shipments.length, 2);
  assert.equal(r.recommended.shipsComplete, true);
  assert.deepEqual(
    r.recommended.shipments.map((s) => [s.warehouseId, s.lines[0].qty]),
    [
      ["south", 8],
      ["main", 2],
    ],
  );
  assert.equal(r.plans[1].shipments.length, 1);
  assert.equal(r.plans[1].backorderedUnits, 2);

  // 5 UPS: Main covers alone and is cheapest
  const single = planSplit([{ productId: "ups", qty: 5 }], warehouses);
  assert.equal(single.recommended.shipments.length, 1);
  assert.equal(single.recommended.shipments[0].warehouseId, "main");
});
