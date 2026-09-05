"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { computeRisk } from "@/lib/engine/risk";
import { routeQuotation } from "@/lib/engine/routing";
import { quotationTotals } from "@/lib/quotes";
import { useToast } from "@/components/ui/Toast";
import { ProductPicker } from "./ProductPicker";
import { CartTable } from "./CartTable";
import { RiskRail } from "./RiskRail";
import type { BuilderConfig, BuilderLine, BuilderPermissions, BuilderQuotation, CatalogItem, PlanOpt, UpsellItem } from "./types";

type Props = {
  quotation: BuilderQuotation;
  lines: BuilderLine[];
  catalog: CatalogItem[];
  categories: { id: string; name: string }[];
  plans: PlanOpt[];
  config: BuilderConfig;
  /** categoryId → ceiling % for this customer's tier (so a freshly added line has its ceiling before the server round-trip). */
  ceilings: Record<string, number>;
  upsell: UpsellItem[];
  permissions: BuilderPermissions;
  portalUrl: string | null;
  serverVersion: string;
};

type LinePatch = { qty?: number; discountPct?: number; variantId?: string | null; planId?: string | null };

export function Builder(props: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [lines, setLines] = useState<BuilderLine[]>(props.lines);

  // Pending (scheduled or in-flight) mutations. While > 0 we do not overwrite local edits with server props.
  const dirty = useRef(0);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const patches = useRef<Map<string, LinePatch>>(new Map());

  useEffect(() => {
    if (dirty.current === 0) setLines(props.lines);
  }, [props.lines]);

  const risk = useMemo(
    () =>
      computeRisk(
        lines.map((l) => ({
          lineId: l.id,
          name: l.name,
          qty: l.qty,
          discountPct: l.discountPct,
          effectiveList: l.unitPrice,
          cost: l.cost,
          ceilingPct: l.ceilingPct,
        })),
      ),
    [lines],
  );
  const totals = useMemo(
    () => quotationTotals(lines.map((l) => ({ qty: l.qty, unitPrice: l.unitPrice, discountPct: l.discountPct, product: { taxPct: l.taxPct } }))),
    [lines],
  );
  const decision = useMemo(
    () => routeQuotation({ blended: risk.blended, maxLineOverage: risk.maxLineOverage, total: totals.net }, props.config),
    [risk, totals, props.config],
  );

  const finish = useCallback(() => {
    dirty.current -= 1;
    if (dirty.current <= 0) {
      dirty.current = 0;
      router.refresh();
    }
  }, [router]);

  const request = useCallback(
    async (input: RequestInfo, init?: RequestInit): Promise<Record<string, unknown> | null> => {
      try {
        const res = await fetch(input, { headers: { "Content-Type": "application/json" }, ...init });
        const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        if (!res.ok) {
          toast({ title: (data.error as string) ?? "That did not work", tone: "danger" });
          return null;
        }
        if (data.rerouted && data.rerouted !== "AUTO_APPROVED") {
          toast({
            title: "Terms changed — quotation re-entered approval",
            description: "Earlier approvals were voided; routing ran again from scratch.",
            tone: "warn",
          });
        }
        return data;
      } catch {
        toast({ title: "Could not reach the server", tone: "danger" });
        return null;
      }
    },
    [toast],
  );

  /** Debounced per-line PATCH; local state updates immediately so the rail moves as you type. */
  const scheduleLinePatch = useCallback(
    (lineId: string, patch: LinePatch) => {
      setLines((prev) => prev.map((l) => (l.id === lineId ? { ...l, ...applyLocal(l, patch) } : l)));
      const merged = { ...(patches.current.get(lineId) ?? {}), ...patch };
      patches.current.set(lineId, merged);
      const existing = timers.current.get(lineId);
      if (existing) clearTimeout(existing);
      else dirty.current += 1;
      timers.current.set(
        lineId,
        setTimeout(async () => {
          timers.current.delete(lineId);
          const body = patches.current.get(lineId);
          patches.current.delete(lineId);
          try {
            await request(`/api/quotations/${props.quotation.id}/lines/${lineId}`, { method: "PATCH", body: JSON.stringify(body) });
          } finally {
            finish();
          }
        }, 400),
      );
    },
    [finish, props.quotation.id, request],
  );

  const addProduct = useCallback(
    async (item: CatalogItem, variantId: string | null, planId: string | null, qty = 1) => {
      dirty.current += 1;
      try {
        const data = await request(`/api/quotations/${props.quotation.id}/lines`, {
          method: "POST",
          body: JSON.stringify({ productId: item.id, variantId, planId, qty }),
        });
        if (data?.line) {
          const line = data.line as { id: string; qty: number; unitPrice: number; discountPct: number; variantId: string | null; planId: string | null };
          setLines((prev) => {
            const idx = prev.findIndex((l) => l.id === line.id);
            const variant = item.variants.find((v) => v.id === line.variantId) ?? null;
            const plan = props.plans.find((p) => p.id === line.planId) ?? null;
            const next: BuilderLine = {
              id: line.id,
              productId: item.id,
              name: item.name,
              sku: item.sku,
              categoryName: item.categoryName,
              unit: item.unit,
              isRecurring: item.kind === "RECURRING",
              variantId: variant?.id ?? null,
              variantValue: variant?.value ?? null,
              planId: plan?.id ?? null,
              planName: plan?.name ?? null,
              qty: line.qty,
              unitPrice: line.unitPrice,
              discountPct: line.discountPct,
              cost: item.cost,
              taxPct: item.taxPct,
              ceilingPct: props.ceilings[item.categoryId] ?? 0,
              variants: item.variants,
            };
            if (idx >= 0) return prev.map((l, i) => (i === idx ? { ...l, qty: line.qty, discountPct: line.discountPct } : l));
            return [...prev, next];
          });
          toast({ title: `Added ${item.name}`, description: "Total and margin updated.", tone: "money", durationMs: 2200 });
        }
      } finally {
        finish();
      }
    },
    [finish, props.ceilings, props.plans, props.quotation.id, request, toast],
  );

  const removeLine = useCallback(
    async (lineId: string) => {
      setLines((prev) => prev.filter((l) => l.id !== lineId));
      dirty.current += 1;
      try {
        await request(`/api/quotations/${props.quotation.id}/lines/${lineId}`, { method: "DELETE" });
      } finally {
        finish();
      }
    },
    [finish, props.quotation.id, request],
  );

  const applyOrderDiscount = useCallback(
    async (pct: number) => {
      setLines((prev) => prev.map((l) => ({ ...l, discountPct: pct })));
      dirty.current += 1;
      try {
        await request(`/api/quotations/${props.quotation.id}/discount`, { method: "POST", body: JSON.stringify({ pct }) });
      } finally {
        finish();
      }
    },
    [finish, props.quotation.id, request],
  );

  return (
    <div className="grid grid-cols-12 gap-5">
      <div className="col-span-12 flex flex-col gap-5 xl:col-span-7">
        {props.permissions.canEdit ? (
          <ProductPicker currency={props.quotation.currency} catalog={props.catalog} categories={props.categories} plans={props.plans} onAdd={addProduct} tier={props.quotation.customerTier} />
        ) : null}
        <CartTable currency={props.quotation.currency}
          lines={lines}
          plans={props.plans}
          risk={risk}
          totals={totals}
          canEdit={props.permissions.canEdit}
          onPatch={scheduleLinePatch}
          onRemove={removeLine}
          onOrderDiscount={applyOrderDiscount}
        />
      </div>
      <div className="col-span-12 xl:col-span-5">
        <RiskRail
          quotation={props.quotation}
          risk={risk}
          totals={totals}
          decision={decision}
          config={props.config}
          upsell={props.upsell}
          catalog={props.catalog}
          permissions={props.permissions}
          portalUrl={props.portalUrl}
          lineCount={lines.length}
          onAddUpsell={(item) => addProduct(item, item.variants[0]?.id ?? null, null, 1)}
        />
      </div>
    </div>
  );
}

function applyLocal(line: BuilderLine, patch: LinePatch): Partial<BuilderLine> {
  const out: Partial<BuilderLine> = {};
  if (patch.qty != null) out.qty = patch.qty;
  if (patch.discountPct != null) out.discountPct = patch.discountPct;
  if (patch.variantId !== undefined) {
    const v = line.variants.find((x) => x.id === patch.variantId) ?? null;
    const base = line.unitPrice - (line.variants.find((x) => x.id === line.variantId)?.extraPrice ?? 0);
    out.variantId = v?.id ?? null;
    out.variantValue = v?.value ?? null;
    out.unitPrice = base + (v?.extraPrice ?? 0);
  }
  if (patch.planId !== undefined) out.planId = patch.planId;
  return out;
}
