"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { IconPlus } from "@/components/ui/icons";
import { formatMoney } from "@/lib/money";
import { SaveBar } from "./SaveBar";

type Warehouse = { id: string; name: string; city: string; shippingCostWeight: number };
type Product = { id: string; name: string; sku: string; unit: string };

export function WarehouseConfig({
  warehouses,
  products,
  stock,
  reorderPoints,
  canEdit,
}: {
  warehouses: Warehouse[];
  products: Product[];
  stock: Record<string, number>;
  /** Replenishment rule per warehouse and product, keyed the same way as `stock`. */
  reorderPoints: Record<string, number>;
  canEdit: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const cellKeys = useMemo(() => warehouses.flatMap((w) => products.map((p) => `${w.id}:${p.id}`)), [warehouses, products]);
  const [draft, setDraft] = useState<Record<string, string>>(() =>
    Object.fromEntries(warehouses.flatMap((w) => products.map((p) => [`${w.id}:${p.id}`, String(stock[`${w.id}:${p.id}`] ?? 0)]))),
  );
  const [points, setPoints] = useState<Record<string, string>>(() =>
    Object.fromEntries(warehouses.flatMap((w) => products.map((p) => [`${w.id}:${p.id}`, String(reorderPoints[`${w.id}:${p.id}`] ?? 0)]))),
  );
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newWarehouse, setNewWarehouse] = useState({ name: "", city: "", cost: "" });

  const dirty = useMemo(
    () =>
      cellKeys.some(
        (key) => (Number(draft[key]) || 0) !== (stock[key] ?? 0) || (Number(points[key]) || 0) !== (reorderPoints[key] ?? 0),
      ),
    [cellKeys, draft, points, stock, reorderPoints],
  );
  const bad = (v: string | undefined) => v === undefined || v === "" || Number.isNaN(Number(v)) || Number(v) < 0;
  const invalid = Object.values(draft).some(bad) || Object.values(points).some(bad);

  /** A line is low when a reorder point is set and stock has reached it. Mirrors needsRestock(). */
  const isLow = (key: string) => {
    const point = Number(points[key]) || 0;
    return point > 0 && (Number(draft[key]) || 0) <= point;
  };
  const lowCount = cellKeys.filter(isLow).length;

  async function saveStock() {
    setBusy(true);
    try {
      const cells = cellKeys.map((key) => {
        const [warehouseId, productId] = key.split(":");
        return {
          warehouseId,
          productId,
          qty: Math.max(0, Math.round(Number(draft[key]) || 0)),
          reorderPoint: Math.max(0, Math.round(Number(points[key]) || 0)),
        };
      });
      const res = await fetch("/api/config/stock", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cells }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: data.error ?? "Could not save stock", tone: "danger" });
        return;
      }
      const saved = [
        data.changed ? `${data.changed} stock ${data.changed === 1 ? "level" : "levels"}` : null,
        data.reorderPointsChanged ? `${data.reorderPointsChanged} reorder ${data.reorderPointsChanged === 1 ? "point" : "points"}` : null,
      ].filter(Boolean);
      toast({
        title: `${saved.join(" and ")} saved`,
        description: data.lowCount ? `${data.lowCount} lines are at or below their reorder point.` : "Nothing needs restocking.",
        tone: data.lowCount ? "warn" : "money",
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function addWarehouse() {
    setBusy(true);
    try {
      const res = await fetch("/api/config/warehouses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newWarehouse.name.trim(),
          city: newWarehouse.city.trim(),
          shippingCostWeight: Math.round(Number(newWarehouse.cost) * 100),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: data.error ?? "Could not add the warehouse", tone: "danger" });
        return;
      }
      setAdding(false);
      setNewWarehouse({ name: "", city: "", cost: "" });
      toast({ title: `${data.warehouse.name} added`, tone: "money" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <div className="flex items-start justify-between gap-4 px-5 pt-4 pb-2">
          <div>
            <h2>Warehouses</h2>
            <p className="text-[13px] text-muted">Shipping cost is charged once per shipment, and decides which split is cheapest.</p>
          </div>
          {canEdit ? (
            <Button variant="secondary" icon={<IconPlus size={14} />} onClick={() => setAdding(true)}>
              Add warehouse
            </Button>
          ) : null}
        </div>
        <div className="overflow-x-auto px-5 pb-5">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>City</th>
                <th className="num">Shipping cost</th>
                <th className="num">Products stocked</th>
                <th className="num">Units on hand</th>
                <th className="num">Needs restocking</th>
              </tr>
            </thead>
            <tbody>
              {warehouses.map((w) => {
                const held = products.filter((p) => (stock[`${w.id}:${p.id}`] ?? 0) > 0);
                const units = held.reduce((s, p) => s + (stock[`${w.id}:${p.id}`] ?? 0), 0);
                const low = products.filter((p) => isLow(`${w.id}:${p.id}`)).length;
                return (
                  <tr key={w.id}>
                    <td className="font-medium">{w.name}</td>
                    <td className="text-muted">{w.city}</td>
                    <td className="num">{formatMoney(w.shippingCostWeight, { whole: true })}</td>
                    <td className="num">{held.length}</td>
                    <td className="num">{units}</td>
                    <td className={low > 0 ? "num text-warn" : "num text-faint"}>{low > 0 ? `${low} lines` : "None"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <SaveBar
          title="Stock on hand and reorder points"
          description={
            lowCount > 0
              ? `What the split engine may draw from. ${lowCount} ${lowCount === 1 ? "line is" : "lines are"} at or below the reorder point.`
              : "What the split engine may draw from. A product short everywhere becomes a backorder."
          }
          dirty={dirty}
          busy={busy}
          disabled={invalid || !canEdit}
          onSave={saveStock}
          label="Save stock"
        />
        <div className="max-h-[560px] overflow-auto px-5 pb-5">
          <table className="table">
            <thead>
              <tr>
                <th>Product</th>
                {warehouses.map((w) => (
                  <th key={w.id} className="num">
                    <div>{w.name}</div>
                    <div className="text-[12px] font-normal text-faint">on hand · reorder at</div>
                  </th>
                ))}
                <th className="num">Total</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => {
                const total = warehouses.reduce((s, w) => s + (Number(draft[`${w.id}:${p.id}`]) || 0), 0);
                return (
                  <tr key={p.id}>
                    <td>
                      <div className="font-medium">{p.name}</div>
                      <div className="num text-[12px] text-muted">{p.sku}</div>
                    </td>
                    {warehouses.map((w) => {
                      const key = `${w.id}:${p.id}`;
                      const low = isLow(key);
                      return (
                        <td key={w.id} className="num">
                          <div className="flex items-center justify-end gap-1.5">
                            <Input
                              numeric
                              dense
                              type="number"
                              min={0}
                              disabled={!canEdit}
                              // The tint is the rule showing its working: stock has reached the point beside it.
                              className={low ? "w-[68px] input-low" : "w-[68px]"}
                              value={draft[key] ?? "0"}
                              onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
                              aria-label={`${p.name} on hand at ${w.name}`}
                            />
                            <span aria-hidden className="text-[12px] text-faint">·</span>
                            <Input
                              numeric
                              dense
                              type="number"
                              min={0}
                              disabled={!canEdit}
                              className="w-[60px] text-muted"
                              value={points[key] ?? "0"}
                              onChange={(e) => setPoints((d) => ({ ...d, [key]: e.target.value }))}
                              aria-label={`${p.name} reorder point at ${w.name}`}
                              title="Reorder point — 0 switches the rule off for this line"
                            />
                          </div>
                        </td>
                      );
                    })}
                    <td className={total === 0 ? "num text-danger" : "num"}>{total}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal
        open={adding}
        onClose={() => setAdding(false)}
        title="Add a warehouse"
        description="Shipping cost stands in for what one shipment from here costs."
        footer={
          <>
            <Button variant="ghost" onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={busy}
              disabled={newWarehouse.name.trim().length < 2 || newWarehouse.city.trim().length < 2 || Number.isNaN(Number(newWarehouse.cost)) || newWarehouse.cost === ""}
              onClick={addWarehouse}
            >
              Add warehouse
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <Field label="Name">
            <Input value={newWarehouse.name} onChange={(e) => setNewWarehouse((w) => ({ ...w, name: e.target.value }))} placeholder="West Depot" />
          </Field>
          <Field label="City">
            <Input value={newWarehouse.city} onChange={(e) => setNewWarehouse((w) => ({ ...w, city: e.target.value }))} placeholder="Nagpur" />
          </Field>
          <Field label="Shipping cost per shipment" hint="In rupees">
            <Input numeric type="number" min={0} value={newWarehouse.cost} onChange={(e) => setNewWarehouse((w) => ({ ...w, cost: e.target.value }))} placeholder="500" />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
