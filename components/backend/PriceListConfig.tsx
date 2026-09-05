"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { formatMoney } from "@/lib/money";
import { SaveBar } from "./SaveBar";

type Product = { id: string; name: string; sku: string; listPrice: number };

/** Tier prices override the catalogue list price. An empty cell means "use the list price". */
export function PriceListConfig({
  tiers,
  products,
  overrides,
  canEdit,
}: {
  tiers: string[];
  products: Product[];
  overrides: Record<string, number>;
  canEdit: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [draft, setDraft] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      tiers.flatMap((t) =>
        products.map((p) => {
          const v = overrides[`${t}:${p.id}`];
          return [`${t}:${p.id}`, v != null ? (v / 100).toFixed(0) : ""];
        }),
      ),
    ),
  );
  const [busy, setBusy] = useState(false);

  const dirty = useMemo(
    () =>
      Object.entries(draft).some(([key, value]) => {
        const current = overrides[key];
        const parsed = value.trim() === "" ? null : Math.round(Number(value) * 100);
        return parsed !== (current ?? null);
      }),
    [draft, overrides],
  );
  const invalid = Object.values(draft).some((v) => v.trim() !== "" && (Number.isNaN(Number(v)) || Number(v) < 0));

  async function save() {
    setBusy(true);
    try {
      const cells = Object.entries(draft).map(([key, value]) => {
        const [tier, productId] = key.split(":");
        return { tier, productId, price: value.trim() === "" ? null : Math.round(Number(value) * 100) };
      });
      const res = await fetch("/api/config/price-list", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cells }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: data.error ?? "Could not save the price list", tone: "danger" });
        return;
      }
      toast({ title: `${data.changed} tier ${data.changed === 1 ? "price" : "prices"} saved`, tone: "money" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <SaveBar
        title="Tier price lists"
        description="A price here replaces the catalogue list price for that tier. Leave a cell empty to use the list price."
        dirty={dirty}
        busy={busy}
        disabled={invalid || !canEdit}
        onSave={save}
        label="Save prices"
      />
      <div className="max-h-[620px] overflow-auto px-5 pb-5">
        <table className="table">
          <thead>
            <tr>
              <th>Product</th>
              <th className="num">List price</th>
              {tiers.map((t) => (
                <th key={t} className="num">
                  {t.charAt(0) + t.slice(1).toLowerCase()}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id}>
                <td>
                  <div className="font-medium">{p.name}</div>
                  <div className="num text-[11px] text-muted">{p.sku}</div>
                </td>
                <td className="num text-muted">{formatMoney(p.listPrice, { whole: true })}</td>
                {tiers.map((t) => (
                  <td key={t} className="num">
                    <Input
                      numeric
                      dense
                      type="number"
                      min={0}
                      disabled={!canEdit}
                      className="w-28"
                      placeholder="list"
                      value={draft[`${t}:${p.id}`] ?? ""}
                      onChange={(e) => setDraft((d) => ({ ...d, [`${t}:${p.id}`]: e.target.value }))}
                      aria-label={`${p.name} ${t} price`}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
