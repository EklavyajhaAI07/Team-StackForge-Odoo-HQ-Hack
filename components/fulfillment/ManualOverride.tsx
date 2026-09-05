"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/money";
import type { WarehouseView } from "./Fulfillment";

type SplitResponse = {
  replenishment?: { productName: string; warehouseName: string; qty: number; reorderPoint: number; suggestedOrderQty: number }[];
};

export function ManualOverride({
  orderId,
  demand,
  warehouses,
  onDone,
}: {
  orderId: string;
  demand: { productId: string; name?: string; qty: number }[];
  warehouses: WarehouseView[];
  /** Receives the split response so the caller can surface anything it reports, such as a reorder point being reached. */
  onDone: (data?: SplitResponse) => void;
}) {
  const [alloc, setAlloc] = useState<Record<string, Record<string, string>>>({});
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const get = (w: string, p: string) => alloc[w]?.[p] ?? "";
  const num = (w: string, p: string) => Number(get(w, p)) || 0;

  const totals = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of demand) map.set(d.productId, warehouses.reduce((s, w) => s + num(w.id, d.productId), 0));
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alloc, demand, warehouses]);

  const balanced = demand.every((d) => (totals.get(d.productId) ?? 0) === d.qty);
  const overStock = demand.some((d) => warehouses.some((w) => num(w.id, d.productId) > (w.stock[d.productId] ?? 0)));

  async function apply() {
    setBusy(true);
    setErrors([]);
    try {
      const allocation: Record<string, Record<string, number>> = {};
      for (const w of warehouses) {
        for (const d of demand) {
          const n = num(w.id, d.productId);
          if (n > 0) {
            allocation[w.id] = allocation[w.id] ?? {};
            allocation[w.id][d.productId] = n;
          }
        }
      }
      const res = await fetch(`/api/orders/${orderId}/split`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "OVERRIDE", allocation }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrors(Array.isArray(data.details) ? data.details : [data.error ?? "Could not apply the override"]);
        return;
      }
      onDone(data);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Product</th>
              <th className="num">Needed</th>
              {warehouses.map((w) => (
                <th key={w.id} className="num">
                  {w.name}
                  <div className="num text-[11px] font-normal text-muted">{formatMoney(w.shippingCostWeight, { whole: true })}/shipment</div>
                </th>
              ))}
              <th className="num">Assigned</th>
            </tr>
          </thead>
          <tbody>
            {demand.map((d) => {
              const assigned = totals.get(d.productId) ?? 0;
              return (
                <tr key={d.productId}>
                  <td className="font-medium">{d.name}</td>
                  <td className="num">{d.qty}</td>
                  {warehouses.map((w) => {
                    const onHand = w.stock[d.productId] ?? 0;
                    const value = num(w.id, d.productId);
                    return (
                      <td key={w.id} className="num">
                        <Input
                          numeric
                          dense
                          type="number"
                          min={0}
                          max={onHand}
                          className={cn("w-16", value > onHand && "border-danger text-danger")}
                          value={get(w.id, d.productId)}
                          placeholder="0"
                          onChange={(e) => setAlloc((a) => ({ ...a, [w.id]: { ...a[w.id], [d.productId]: e.target.value } }))}
                          aria-label={`${d.name} at ${w.name}`}
                        />
                        <div className="text-[11px] text-muted">{onHand} on hand</div>
                      </td>
                    );
                  })}
                  <td className={cn("num", assigned === d.qty ? "text-money" : "text-warn")}>
                    {assigned}/{d.qty}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {errors.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {errors.map((e, i) => (
            <li key={i} className="text-[13px] text-danger">
              {e}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex items-center justify-between">
        <p className="text-[13px] text-muted">
          {balanced ? "Quantities balance — ready to apply." : "Assign every unit before applying."}
          {overStock ? " One or more cells exceed stock on hand." : ""}
        </p>
        <Button variant="primary" disabled={!balanced || overStock} loading={busy} onClick={apply}>
          Apply override
        </Button>
      </div>
    </div>
  );
}
