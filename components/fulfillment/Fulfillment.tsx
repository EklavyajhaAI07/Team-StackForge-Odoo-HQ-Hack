"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { ORDER_STATUS, Pill, SHIPMENT_STATUS, StatusPill } from "@/components/ui/Pill";
import { useToast } from "@/components/ui/Toast";
import { IconBox, IconTruck } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import type { SplitPlan } from "@/lib/engine/split";
import { formatDate } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { ManualOverride } from "./ManualOverride";
import { StockArrival } from "./StockArrival";

export type WarehouseView = { id: string; name: string; city: string; shippingCostWeight: number; stock: Record<string, number> };
export type ShipmentView = {
  id: string;
  warehouseName: string;
  warehouseCity: string;
  status: string;
  cost: number;
  lines: { productId: string; name: string; qty: number }[];
};
export type OrderView = {
  id: string;
  status: string;
  promisedDate: string | null;
  shipments: ShipmentView[];
  backorders: { id: string; productId: string; name: string; qty: number; status: string }[];
};

export function Fulfillment({
  order,
  demand,
  nonShippable,
  remaining,
  plans,
  warehouses,
  canDecide,
}: {
  quotationId: string;
  order: OrderView;
  demand: { productId: string; name?: string; qty: number }[];
  nonShippable: { productId: string; name: string; qty: number }[];
  remaining: { productId: string; name?: string; qty: number }[];
  plans: SplitPlan[];
  warehouses: WarehouseView[];
  canDecide: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const openBackorders = order.backorders.filter((b) => b.status === "OPEN");

  async function post(url: string, body: unknown, label: string) {
    setBusy(label);
    setError(null);
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "That did not work");
        toast({ title: data.error ?? "That did not work", tone: "danger" });
        return null;
      }
      router.refresh();
      return data;
    } finally {
      setBusy(null);
    }
  }

  async function acceptPlan(plan: SplitPlan) {
    const data = await post(`/api/orders/${order.id}/split`, { mode: "ACCEPT", planKey: plan.key }, plan.key);
    if (data) toast({ title: "Split accepted", description: plan.label, tone: "money" });
  }

  async function consolidate() {
    const data = await post(`/api/orders/${order.id}/consolidate`, {}, "consolidate");
    if (data) toast({ title: "Backorder consolidated", description: `${data.shipments} shipment created`, tone: "money" });
  }

  async function setShipmentStatus(id: string, status: string) {
    setBusy(id);
    try {
      const res = await fetch(`/api/shipments/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
      if (res.ok) router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid grid-cols-12 gap-5">
      <div className="col-span-12 flex flex-col gap-5 xl:col-span-8">
        {remaining.length > 0 ? (
          <Card>
            <div className="px-5 pt-4 pb-1">
              <h3 className="text-[15px] font-semibold">Suggested warehouse split</h3>
              <p className="text-[12px] text-muted">
                Greedy by coverage, then by shipping cost. Compare the options and accept one, or set the quantities yourself.
              </p>
            </div>
            <div className="grid gap-3 px-5 py-4 md:grid-cols-2">
              {plans.map((plan, i) => (
                <div key={plan.key} className={cn("rounded-[12px] border p-4", i === 0 ? "border-primary bg-primary-soft/40" : "border-border")}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[14px] font-semibold">{plan.label}</p>
                    {i === 0 ? <Pill tone="primary">Recommended</Pill> : null}
                  </div>
                  <dl className="mt-3 flex flex-col gap-1 text-[12px]">
                    {plan.shipments.map((s, si) => (
                      <div key={si} className="flex items-baseline justify-between gap-2">
                        <dt className="text-muted">
                          {s.warehouseName} · {s.lines.map((l) => `${l.name ?? l.productId} × ${l.qty}`).join(", ")}
                        </dt>
                        <dd className="num">{formatMoney(s.cost, { whole: true })}</dd>
                      </div>
                    ))}
                    {plan.backorders.map((b) => (
                      <div key={b.productId} className="flex items-baseline justify-between gap-2 text-warn">
                        <dt>{b.name ?? b.productId} — backordered</dt>
                        <dd className="num">× {b.qty}</dd>
                      </div>
                    ))}
                  </dl>
                  <ul className="mt-3 flex flex-col gap-1 border-t border-border pt-2 text-[11px] text-muted">
                    {plan.explanation.map((line, li) => (
                      <li key={li}>{line}</li>
                    ))}
                  </ul>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="num text-[13px]">{formatMoney(plan.totalCost, { whole: true })} shipping</span>
                    {canDecide ? (
                      <Button size="sm" variant={i === 0 ? "primary" : "secondary"} loading={busy === plan.key} onClick={() => acceptPlan(plan)}>
                        {i === 0 ? "Accept suggested split" : "Accept this plan"}
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
            {canDecide ? (
              <div className="flex items-center justify-between border-t border-border px-5 py-3">
                <p className="text-[12px] text-muted">Need a different allocation? Set per-warehouse quantities by hand.</p>
                <Button size="sm" variant="secondary" onClick={() => setOverrideOpen(true)}>
                  Manual override
                </Button>
              </div>
            ) : null}
            {error ? <p className="px-5 pb-4 text-[12px] text-danger">{error}</p> : null}
          </Card>
        ) : (
          <Card className="px-5 py-4">
            <div className="flex items-center gap-2">
              <IconTruck size={16} className="text-money" />
              <p className="text-[14px] font-medium">Every ordered unit is on a shipment</p>
            </div>
            <p className="mt-1 text-[13px] text-muted">Nothing left to allocate. Move shipments along below.</p>
          </Card>
        )}

        <Card>
          <div className="flex items-center justify-between px-5 pt-4 pb-2">
            <h3 className="text-[15px] font-semibold">Shipments</h3>
            <StatusPill status={order.status} map={ORDER_STATUS} />
          </div>
          {order.shipments.length === 0 ? (
            <div className="px-5 pb-5">
              <EmptyState compact title="No shipments yet" description="Accept a split plan to create them." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Warehouse</th>
                    <th>Contents</th>
                    <th className="num">Shipping</th>
                    <th>Status</th>
                    {canDecide ? <th aria-label="Actions" /> : null}
                  </tr>
                </thead>
                <tbody>
                  {order.shipments.map((s) => (
                    <tr key={s.id}>
                      <td>
                        <div className="font-medium">{s.warehouseName}</div>
                        <div className="text-[11px] text-muted">{s.warehouseCity}</div>
                      </td>
                      <td className="text-muted">{s.lines.map((l) => `${l.name} × ${l.qty}`).join(", ")}</td>
                      <td className="num">{formatMoney(s.cost, { whole: true })}</td>
                      <td>
                        <StatusPill status={s.status} map={SHIPMENT_STATUS} />
                      </td>
                      {canDecide ? (
                        <td className="text-right">
                          {s.status !== "DELIVERED" ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              loading={busy === s.id}
                              onClick={() => setShipmentStatus(s.id, s.status === "PLANNED" ? "SHIPPED" : "DELIVERED")}
                            >
                              Mark {s.status === "PLANNED" ? "shipped" : "delivered"}
                            </Button>
                          ) : null}
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {order.backorders.length > 0 ? (
          <Card>
            <div className="flex items-center justify-between px-5 pt-4 pb-2">
              <div>
                <h3 className="text-[15px] font-semibold">Backorders</h3>
                <p className="text-[12px] text-muted">Units no warehouse could supply when the split was accepted.</p>
              </div>
              {canDecide && openBackorders.length > 0 ? (
                <Button size="sm" variant="primary" loading={busy === "consolidate"} onClick={consolidate}>
                  Consolidate remaining backorder
                </Button>
              ) : null}
            </div>
            <ul className="flex flex-col gap-2 px-5 pb-5">
              {order.backorders.map((b) => (
                <li key={b.id} className="flex items-center justify-between rounded-[8px] border border-border px-3 py-2">
                  <span className="flex items-center gap-2 text-[13px]">
                    <IconBox size={14} className={b.status === "OPEN" ? "text-warn" : "text-money"} />
                    {b.name} <span className="num text-muted">× {b.qty}</span>
                  </span>
                  <Pill tone={b.status === "OPEN" ? "warn" : "money"}>{b.status === "OPEN" ? "Open" : "Consolidated"}</Pill>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}
      </div>

      <div className="col-span-12 flex flex-col gap-5 xl:col-span-4">
        <Card>
          <div className="px-5 pt-4 pb-2">
            <h3 className="text-[15px] font-semibold">Order</h3>
          </div>
          <dl className="grid grid-cols-2 gap-y-2 px-5 pb-5 text-[13px]">
            <dt className="text-muted">Status</dt>
            <dd className="text-right">
              <StatusPill status={order.status} map={ORDER_STATUS} />
            </dd>
            <dt className="text-muted">Promised</dt>
            <dd className="num text-right">{order.promisedDate ? formatDate(order.promisedDate) : "—"}</dd>
            <dt className="text-muted">Units ordered</dt>
            <dd className="num text-right">{demand.reduce((s, d) => s + d.qty, 0)}</dd>
            <dt className="text-muted">Units unassigned</dt>
            <dd className="num text-right">{remaining.reduce((s, d) => s + d.qty, 0)}</dd>
            <dt className="text-muted">Shipping so far</dt>
            <dd className="num text-right">{formatMoney(order.shipments.reduce((s, x) => s + x.cost, 0), { whole: true })}</dd>
          </dl>
          {nonShippable.length > 0 ? (
            <div className="mx-5 mb-5 rounded-[8px] border border-border px-3 py-2">
              <p className="text-[12px] text-muted">Delivered by the team, not from a warehouse:</p>
              <ul className="mt-1 flex flex-col gap-0.5">
                {nonShippable.map((n) => (
                  <li key={n.productId} className="flex items-center justify-between text-[12px]">
                    <span>{n.name}</span>
                    <span className="num text-muted">× {n.qty}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Card>

        {canDecide ? <StockArrival orderId={order.id} warehouses={warehouses} backorders={order.backorders} onConsolidate={consolidate} /> : null}

        <Card>
          <div className="px-5 pt-4 pb-2">
            <h3 className="text-[15px] font-semibold">Stock on hand</h3>
            <p className="text-[12px] text-muted">Only the products on this order.</p>
          </div>
          <div className="overflow-x-auto pb-2">
            <table className="table">
              <thead>
                <tr>
                  <th>Product</th>
                  {warehouses.map((w) => (
                    <th key={w.id} className="num" title={`${w.city} · ${formatMoney(w.shippingCostWeight, { whole: true })} per shipment`}>
                      {w.name.replace(" Warehouse", "").replace(" Depot", "").replace(" Hub", "")}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {demand.map((d) => (
                  <tr key={d.productId}>
                    <td className="max-w-[160px] truncate" title={d.name}>
                      {d.name}
                    </td>
                    {warehouses.map((w) => {
                      const qty = w.stock[d.productId] ?? 0;
                      return (
                        <td key={w.id} className={cn("num", qty === 0 && "text-muted")}>
                          {qty}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Modal open={overrideOpen} onClose={() => setOverrideOpen(false)} title="Manual override" description="Quantities must add up to what is still unassigned, and cannot exceed stock on hand." width={720}>
        <ManualOverride
          orderId={order.id}
          demand={remaining}
          warehouses={warehouses}
          onDone={() => {
            setOverrideOpen(false);
            toast({ title: "Manual split applied", tone: "money" });
            router.refresh();
          }}
        />
      </Modal>
    </div>
  );
}
