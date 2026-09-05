"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input, Select } from "@/components/ui/Input";
import { NumberTicker } from "@/components/ui/NumberTicker";
import { IconMinus, IconPlus, IconX } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import type { RiskResult } from "@/lib/engine/risk";
import { formatMoney } from "@/lib/money";
import { lineNet, type Totals } from "@/lib/quotes";
import type { BuilderLine, PlanOpt } from "./types";

export function CartTable({
  lines,
  plans,
  risk,
  totals,
  canEdit,
  onPatch,
  onRemove,
  onOrderDiscount,
}: {
  lines: BuilderLine[];
  plans: PlanOpt[];
  risk: RiskResult;
  totals: Totals;
  canEdit: boolean;
  onPatch: (lineId: string, patch: { qty?: number; discountPct?: number; variantId?: string | null; planId?: string | null }) => void;
  onRemove: (lineId: string) => void;
  onOrderDiscount: (pct: number) => void;
}) {
  const [orderPct, setOrderPct] = useState("");
  const overageById = new Map(risk.perLine.map((p) => [p.lineId, p.overage]));

  return (
    <Card>
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <h3 className="text-[15px] font-semibold">Cart</h3>
        <span className="text-[12px] text-muted">
          {lines.length} line{lines.length === 1 ? "" : "s"}
        </span>
      </div>
      {lines.length === 0 ? (
        <div className="px-4 pb-4">
          <EmptyState compact title="No lines yet" description="Add a product above — the risk rail reacts as soon as you set a discount." />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Item</th>
                <th className="num">Qty</th>
                <th className="num">Unit price</th>
                <th className="num">Discount</th>
                <th className="num">Line total</th>
                {canEdit ? <th aria-label="Remove" /> : null}
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => {
                const over = overageById.get(l.id) ?? 0;
                return (
                  <tr key={l.id}>
                    <td>
                      <div className="text-[13px] font-medium">{l.name}</div>
                      <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted">
                        <span className="num">{l.sku}</span>
                        {l.variants.length > 0 ? (
                          canEdit ? (
                            <Select dense value={l.variantId ?? ""} onChange={(e) => onPatch(l.id, { variantId: e.target.value })} className="h-6 w-[120px] py-0 text-[11px]">
                              {l.variants.map((v) => (
                                <option key={v.id} value={v.id}>
                                  {v.value}
                                </option>
                              ))}
                            </Select>
                          ) : (
                            <span>{l.variantValue}</span>
                          )
                        ) : null}
                        {l.isRecurring ? (
                          canEdit ? (
                            <Select dense value={l.planId ?? ""} onChange={(e) => onPatch(l.id, { planId: e.target.value })} className="h-6 w-[150px] py-0 text-[11px]">
                              {plans.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name}
                                </option>
                              ))}
                            </Select>
                          ) : (
                            <span>Billed {l.planName?.toLowerCase()}</span>
                          )
                        ) : null}
                      </div>
                    </td>
                    <td className="num">
                      {canEdit ? (
                        <div className="inline-flex items-center gap-1">
                          <button type="button" aria-label="Decrease" className="btn btn-ghost h-7 w-7 p-0" onClick={() => onPatch(l.id, { qty: Math.max(1, l.qty - 1) })}>
                            <IconMinus size={12} />
                          </button>
                          <Input
                            numeric
                            dense
                            className="w-14"
                            value={l.qty}
                            min={1}
                            type="number"
                            onChange={(e) => {
                              const n = Math.max(1, Math.floor(Number(e.target.value) || 1));
                              onPatch(l.id, { qty: n });
                            }}
                            aria-label="Quantity"
                          />
                          <button type="button" aria-label="Increase" className="btn btn-ghost h-7 w-7 p-0" onClick={() => onPatch(l.id, { qty: l.qty + 1 })}>
                            <IconPlus size={12} />
                          </button>
                        </div>
                      ) : (
                        l.qty
                      )}
                    </td>
                    <td className="num">{formatMoney(l.unitPrice)}</td>
                    <td className="num">
                      {canEdit ? (
                        <div className="inline-flex flex-col items-end gap-0.5">
                          <div className="relative">
                            <Input
                              numeric
                              dense
                              type="number"
                              min={0}
                              max={100}
                              step={0.5}
                              className={cn("w-20 pr-6", over > 0 && "border-danger text-danger")}
                              value={l.discountPct}
                              onChange={(e) => {
                                const n = Math.min(100, Math.max(0, Number(e.target.value) || 0));
                                onPatch(l.id, { discountPct: n });
                              }}
                              aria-label="Discount percent"
                            />
                            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-muted">%</span>
                          </div>
                          <span className={cn("text-[10px]", over > 0 ? "text-danger" : "text-muted")}>
                            {over > 0 ? `${over.toFixed(1)} over ${l.ceilingPct}%` : `ceiling ${l.ceilingPct}%`}
                          </span>
                        </div>
                      ) : (
                        <span className={over > 0 ? "text-danger" : undefined}>{l.discountPct}%</span>
                      )}
                    </td>
                    <td className="num">{formatMoney(lineNet(l))}</td>
                    {canEdit ? (
                      <td className="w-8 text-right">
                        <button type="button" aria-label={`Remove ${l.name}`} className="rounded p-1 text-muted hover:text-danger" onClick={() => onRemove(l.id)}>
                          <IconX size={14} />
                        </button>
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap items-end justify-between gap-4 border-t border-border px-4 py-4">
        {canEdit && lines.length > 0 ? (
          <div className="flex items-end gap-2">
            <label className="flex flex-col gap-1 text-[12px] text-muted">
              Order-level discount
              <div className="relative">
                <Input numeric dense type="number" min={0} max={100} step={0.5} className="w-24 pr-6" value={orderPct} onChange={(e) => setOrderPct(e.target.value)} placeholder="0" />
                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-muted">%</span>
              </div>
            </label>
            <Button
              size="sm"
              variant="secondary"
              disabled={orderPct === ""}
              onClick={() => {
                const n = Math.min(100, Math.max(0, Number(orderPct) || 0));
                onOrderDiscount(n);
              }}
            >
              Apply to all lines
            </Button>
          </div>
        ) : (
          <div />
        )}
        <dl className="grid min-w-[260px] grid-cols-[1fr_auto] gap-x-6 gap-y-1 text-[13px]">
          <dt className="text-muted">Subtotal (list)</dt>
          <dd className="num text-right">{formatMoney(totals.list)}</dd>
          <dt className="text-muted">Discount</dt>
          <dd className="num text-right text-danger">{totals.discount > 0 ? `−${formatMoney(totals.discount)}` : formatMoney(0)}</dd>
          <dt className="text-muted">Tax</dt>
          <dd className="num text-right">{formatMoney(totals.tax)}</dd>
          <dt className="border-t border-border pt-1 font-semibold">Total</dt>
          <dd className="border-t border-border pt-1 text-right text-[15px] font-semibold">
            <NumberTicker value={totals.total} format={(n) => formatMoney(Math.round(n))} className="num" />
          </dd>
        </dl>
      </div>
    </Card>
  );
}
