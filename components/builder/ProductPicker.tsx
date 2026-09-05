"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Input";
import { Pill } from "@/components/ui/Pill";
import { IconPlus, IconSearch } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/money";
import type { CatalogItem, PlanOpt } from "./types";

export function ProductPicker({
  catalog,
  categories,
  plans,
  tier,
  onAdd,
}: {
  catalog: CatalogItem[];
  categories: { id: string; name: string }[];
  plans: PlanOpt[];
  tier: string;
  onAdd: (item: CatalogItem, variantId: string | null, planId: string | null) => Promise<void>;
}) {
  const [category, setCategory] = useState(categories[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [choice, setChoice] = useState<Record<string, { variantId?: string; planId?: string }>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    return catalog.filter((p) => (q ? p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) : p.categoryId === category));
  }, [catalog, category, query]);

  const tierLabel = tier.charAt(0) + tier.slice(1).toLowerCase();

  return (
    <Card>
      <div className="flex items-center justify-between gap-3 px-4 pt-3">
        <div className="flex items-center gap-1" role="tablist" aria-label="Category">
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={!query && category === c.id}
              onClick={() => {
                setCategory(c.id);
                setQuery("");
              }}
              className={cn(
                "h-8 rounded-[8px] px-3 text-[14px] font-medium transition-colors",
                !query && category === c.id ? "bg-raised text-text" : "text-muted hover:text-text",
              )}
            >
              {c.name}
            </button>
          ))}
        </div>
        <div className="relative w-[220px]">
          <IconSearch size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
          <Input dense value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search products" className="pl-8" aria-label="Search products" />
        </div>
      </div>

      <div className="mt-3 max-h-[300px] overflow-auto border-t border-border">
        {items.length === 0 ? (
          <p className="px-4 py-6 text-[14px] text-muted">No products match — try another word or category.</p>
        ) : (
          <ul>
            {items.map((p) => {
              const sel = choice[p.id] ?? {};
              const variantId = sel.variantId ?? p.variants[0]?.id ?? null;
              const planId = sel.planId ?? plans[0]?.id ?? null;
              const extra = p.variants.find((v) => v.id === variantId)?.extraPrice ?? 0;
              const price = (p.tierPrice ?? p.listPrice) + extra;
              return (
                <li key={p.id} className="flex items-center gap-3 border-b border-border px-4 py-2 last:border-b-0 hover:bg-raised/60">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[14px] font-medium">{p.name}</span>
                      {p.isPromoted ? <Pill tone="primary">Promoted</Pill> : null}
                    </div>
                    <div className="num text-[12px] text-muted">
                      {p.sku} · per {p.unit}
                    </div>
                  </div>
                  {p.variants.length > 0 ? (
                    <Select
                      dense
                      value={variantId ?? ""}
                      onChange={(e) => setChoice((c) => ({ ...c, [p.id]: { ...c[p.id], variantId: e.target.value } }))}
                      aria-label={p.attributeName ?? "Variant"}
                      className="w-[130px]"
                    >
                      {p.variants.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.value}
                        </option>
                      ))}
                    </Select>
                  ) : null}
                  {p.kind === "RECURRING" ? (
                    <Select
                      dense
                      value={planId ?? ""}
                      onChange={(e) => setChoice((c) => ({ ...c, [p.id]: { ...c[p.id], planId: e.target.value } }))}
                      aria-label="Billing plan"
                      className="w-[150px]"
                    >
                      {plans.map((pl) => (
                        <option key={pl.id} value={pl.id}>
                          {pl.name}
                        </option>
                      ))}
                    </Select>
                  ) : null}
                  <div className="w-[120px] text-right">
                    <div className="num text-[14px]">{formatMoney(price)}</div>
                    {p.tierPrice != null && p.tierPrice !== p.listPrice ? (
                      <div className="text-[12px] text-info">{tierLabel} price</div>
                    ) : null}
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<IconPlus size={13} />}
                    loading={busy === p.id}
                    onClick={async () => {
                      setBusy(p.id);
                      try {
                        await onAdd(p, variantId, p.kind === "RECURRING" ? planId : null);
                      } finally {
                        setBusy(null);
                      }
                    }}
                  >
                    Add
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Card>
  );
}
