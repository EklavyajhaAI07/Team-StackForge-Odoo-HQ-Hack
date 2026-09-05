"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Pill } from "@/components/ui/Pill";
import { useToast } from "@/components/ui/Toast";
import { IconPlus, IconSearch } from "@/components/ui/icons";
import { formatMoney, formatPct } from "@/lib/money";

type Variant = { id: string; value: string; extraPrice: number };
type Product = {
  id: string;
  name: string;
  sku: string;
  categoryId: string;
  categoryName: string;
  kind: string;
  unit: string;
  cost: number;
  listPrice: number;
  taxPct: number;
  isPromoted: boolean;
  attributeName: string | null;
  variants: Variant[];
};

const BLANK = { name: "", sku: "", categoryId: "", kind: "ONE_TIME", unit: "unit", cost: "", listPrice: "", taxPct: "18", description: "", isPromoted: false };

export function ProductsConfig({
  products,
  categories,
  canEdit,
}: {
  products: Product[];
  categories: { id: string; name: string }[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState({ ...BLANK, categoryId: categories[0]?.id ?? "" });

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? products.filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)) : products;
  }, [products, query]);

  function margin(p: Product): number {
    return p.listPrice > 0 ? ((p.listPrice - p.cost) / p.listPrice) * 100 : 0;
  }

  async function patch(id: string, changes: Record<string, unknown>, success: string) {
    setBusy(true);
    try {
      const res = await fetch("/api/config/products", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, ...changes }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: data.error ?? "That did not save", tone: "danger" });
        return;
      }
      toast({ title: success, tone: "money" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function create() {
    setBusy(true);
    try {
      const res = await fetch("/api/config/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: draft.name.trim(),
          sku: draft.sku.trim().toUpperCase(),
          categoryId: draft.categoryId,
          kind: draft.kind,
          unit: draft.unit.trim(),
          cost: Math.round(Number(draft.cost) * 100),
          listPrice: Math.round(Number(draft.listPrice) * 100),
          taxPct: Number(draft.taxPct),
          description: draft.description.trim(),
          isPromoted: draft.isPromoted,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: data.error ?? "Could not add the product", tone: "danger" });
        return;
      }
      setAdding(false);
      setDraft({ ...BLANK, categoryId: categories[0]?.id ?? "" });
      toast({ title: `${data.product.name} added`, tone: "money" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const validNew =
    draft.name.trim().length > 1 &&
    draft.sku.trim().length > 1 &&
    draft.categoryId &&
    draft.cost !== "" &&
    draft.listPrice !== "" &&
    Number(draft.listPrice) >= Number(draft.cost);

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-4 pb-2">
        <div>
          <h2>Catalogue</h2>
          <p className="text-[13px] text-muted">
            {products.length} products. Promoted items are weighted 1.5× when the upsell panel ranks suggestions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-[220px]">
            <IconSearch size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
            <Input dense value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name or SKU" className="pl-8" aria-label="Search products" />
          </div>
          {canEdit ? (
            <Button variant="secondary" icon={<IconPlus size={14} />} onClick={() => setAdding(true)}>
              Add product
            </Button>
          ) : null}
        </div>
      </div>

      <div className="max-h-[620px] overflow-auto px-5 pb-5">
        <table className="table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Category</th>
              <th className="num">Cost</th>
              <th className="num">List price</th>
              <th className="num">Margin</th>
              <th className="num">Tax</th>
              <th>Promoted</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((p) => (
              <tr key={p.id}>
                <td>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{p.name}</span>
                    {p.kind === "RECURRING" ? <Pill tone="info">Subscription</Pill> : null}
                  </div>
                  <div className="num text-[12px] text-muted">
                    {p.sku} · per {p.unit}
                    {p.attributeName ? ` · ${p.attributeName}: ${p.variants.map((v) => v.value).join(", ")}` : ""}
                  </div>
                </td>
                <td className="text-muted">{p.categoryName}</td>
                <td className="num">{formatMoney(p.cost, { whole: true })}</td>
                <td className="num">
                  {canEdit ? (
                    <Input
                      numeric
                      dense
                      type="number"
                      min={0}
                      className="w-28"
                      defaultValue={(p.listPrice / 100).toFixed(0)}
                      aria-label={`${p.name} list price`}
                      onBlur={(e) => {
                        const rupees = Number(e.target.value);
                        const paise = Math.round(rupees * 100);
                        if (!Number.isNaN(paise) && paise !== p.listPrice) patch(p.id, { listPrice: paise }, `${p.name} priced at ${formatMoney(paise, { whole: true })}`);
                      }}
                    />
                  ) : (
                    formatMoney(p.listPrice, { whole: true })
                  )}
                </td>
                <td className={margin(p) < 15 ? "num text-warn" : "num text-money"}>{formatPct(margin(p))}</td>
                <td className="num text-muted">{formatPct(p.taxPct, 0)}</td>
                <td>
                  {canEdit ? (
                    <input
                      type="checkbox"
                      checked={p.isPromoted}
                      disabled={busy}
                      aria-label={`Promote ${p.name}`}
                      onChange={(e) => patch(p.id, { isPromoted: e.target.checked }, `${p.name} ${e.target.checked ? "promoted" : "no longer promoted"}`)}
                    />
                  ) : p.isPromoted ? (
                    <Pill tone="primary">Promoted</Pill>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {visible.length === 0 ? <p className="py-6 text-[14px] text-muted">Nothing matches that search.</p> : null}
      </div>

      <Modal
        open={adding}
        onClose={() => setAdding(false)}
        title="Add a product"
        description="Prices are in rupees. Cost drives the margin figure the rail and the upsell filter use."
        width={620}
        footer={
          <>
            <Button variant="ghost" onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button variant="primary" loading={busy} disabled={!validNew} onClick={create}>
              Add product
            </Button>
          </>
        }
      >
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Name" className="md:col-span-2">
            <Input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} placeholder="Docking Station" />
          </Field>
          <Field label="SKU">
            <Input value={draft.sku} onChange={(e) => setDraft((d) => ({ ...d, sku: e.target.value }))} placeholder="HW-DOCK-01" />
          </Field>
          <Field label="Category">
            <Select value={draft.categoryId} onChange={(e) => setDraft((d) => ({ ...d, categoryId: e.target.value }))}>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Kind">
            <Select value={draft.kind} onChange={(e) => setDraft((d) => ({ ...d, kind: e.target.value }))}>
              <option value="ONE_TIME">One-time</option>
              <option value="RECURRING">Subscription</option>
            </Select>
          </Field>
          <Field label="Unit">
            <Input value={draft.unit} onChange={(e) => setDraft((d) => ({ ...d, unit: e.target.value }))} placeholder="unit" />
          </Field>
          <Field label="Cost (₹)">
            <Input numeric type="number" min={0} value={draft.cost} onChange={(e) => setDraft((d) => ({ ...d, cost: e.target.value }))} />
          </Field>
          <Field label="List price (₹)" error={draft.listPrice !== "" && Number(draft.listPrice) < Number(draft.cost) ? "List price cannot be below cost" : undefined}>
            <Input numeric type="number" min={0} value={draft.listPrice} onChange={(e) => setDraft((d) => ({ ...d, listPrice: e.target.value }))} />
          </Field>
          <Field label="Tax %">
            <Input numeric type="number" min={0} max={100} value={draft.taxPct} onChange={(e) => setDraft((d) => ({ ...d, taxPct: e.target.value }))} />
          </Field>
          <Field label="Promoted" hint="Weighted 1.5× in upsell ranking">
            <label className="flex h-9 items-center gap-2 text-[14px]">
              <input type="checkbox" checked={draft.isPromoted} onChange={(e) => setDraft((d) => ({ ...d, isPromoted: e.target.checked }))} />
              Show as promoted
            </label>
          </Field>
          <Field label="Description" className="md:col-span-2">
            <Input value={draft.description} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} placeholder="One line the customer will read" />
          </Field>
        </div>
      </Modal>
    </Card>
  );
}
