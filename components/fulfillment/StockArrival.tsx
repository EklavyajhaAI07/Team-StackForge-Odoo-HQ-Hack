"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import type { WarehouseView } from "./Fulfillment";

/** §5.3 — simulate an inbound delivery, then offer to consolidate whatever it unblocks. */
export function StockArrival({
  orderId,
  warehouses,
  backorders,
  onConsolidate,
}: {
  orderId: string;
  warehouses: WarehouseView[];
  backorders: { id: string; productId: string; name: string; qty: number; status: string }[];
  onConsolidate: () => Promise<void>;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const open = backorders.filter((b) => b.status === "OPEN");
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id ?? "");
  const [productId, setProductId] = useState(open[0]?.productId ?? "");
  const [qty, setQty] = useState(String(open[0]?.qty ?? 1));
  const [busy, setBusy] = useState(false);
  const [prompt, setPrompt] = useState<{ productName: string; fulfillableQty: number } | null>(null);

  if (open.length === 0) {
    return (
      <Card className="px-5 py-4">
        <h3 className="text-[15px] font-semibold">Simulate stock arrival</h3>
        <p className="mt-1 text-[13px] text-muted">No open backorders — nothing is waiting on inbound stock.</p>
      </Card>
    );
  }

  async function simulate() {
    setBusy(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/stock-arrival`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ warehouseId, productId, qty: Math.max(1, Number(qty) || 1) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: data.error ?? "Could not record the arrival", tone: "danger" });
        return;
      }
      toast({ title: `${data.qty ?? qty} × ${data.productName} arrived at ${data.warehouseName}`, tone: "info" });
      if (data.canConsolidate) setPrompt({ productName: data.productName, fulfillableQty: data.fulfillableQty });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const uniqueProducts = [...new Map(open.map((b) => [b.productId, b])).values()];

  return (
    <Card>
      <div className="px-5 pt-4 pb-2">
        <h3 className="text-[15px] font-semibold">Simulate stock arrival</h3>
        <p className="text-[12px] text-muted">Receive inbound stock, then consolidate what it unblocks.</p>
      </div>
      <div className="flex flex-col gap-3 px-5 pb-5">
        <Field label="Warehouse">
          <Select dense value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name} · {w.city}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Product">
          <Select dense value={productId} onChange={(e) => setProductId(e.target.value)}>
            {uniqueProducts.map((b) => (
              <option key={b.productId} value={b.productId}>
                {b.name} ({b.qty} backordered)
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Quantity arriving">
          <Input numeric dense type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} />
        </Field>
        <Button variant="secondary" loading={busy} onClick={simulate}>
          Record arrival
        </Button>

        {prompt ? (
          <div className="rounded-[8px] border border-money/40 bg-money-soft px-3 py-3">
            <p className="text-[13px] font-medium text-money">Consolidate remaining backorder?</p>
            <p className="mt-0.5 text-[12px] text-muted">
              {prompt.fulfillableQty} × {prompt.productName} can ship now in one consolidation shipment.
            </p>
            <div className="mt-2 flex gap-2">
              <Button
                size="sm"
                variant="money"
                onClick={async () => {
                  setPrompt(null);
                  await onConsolidate();
                }}
              >
                Consolidate now
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setPrompt(null)}>
                Later
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
