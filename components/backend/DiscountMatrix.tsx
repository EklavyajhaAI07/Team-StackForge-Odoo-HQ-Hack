"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";

/**
 * The governance grid: one ceiling per tier and category. Editing a cell changes what counts
 * as an overage, which changes the blended risk score and therefore the whole approval route.
 */
export function DiscountMatrix({
  tiers,
  categories,
  cells,
  canEdit,
}: {
  tiers: string[];
  categories: { id: string; name: string }[];
  cells: Record<string, number>;
  canEdit: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [draft, setDraft] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      tiers.flatMap((t) => categories.map((c) => [`${t}:${c.id}`, cells[`${t}:${c.id}`] != null ? String(cells[`${t}:${c.id}`]) : ""])),
    ),
  );
  const [busy, setBusy] = useState(false);

  const dirty = useMemo(
    () =>
      Object.entries(draft).some(([key, value]) => {
        const original = cells[key];
        const parsed = value === "" ? null : Number(value);
        return parsed !== (original ?? null);
      }),
    [draft, cells],
  );

  const invalid = Object.values(draft).some((v) => v !== "" && (Number.isNaN(Number(v)) || Number(v) < 0 || Number(v) > 100));

  async function save() {
    setBusy(true);
    try {
      const payload = Object.entries(draft)
        .filter(([, v]) => v !== "")
        .map(([key, v]) => {
          const [tier, categoryId] = key.split(":");
          return { tier, categoryId, ceilingPct: Number(v) };
        });
      const res = await fetch("/api/config/discount-policy", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cells: payload }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: data.error ?? "Could not save the policy", tone: "danger" });
        return;
      }
      toast({
        title: data.changed === 0 ? "Nothing to change" : `${data.changed} ceiling${data.changed === 1 ? "" : "s"} updated`,
        description: data.changed ? "New quotations route against the new ceilings straight away." : undefined,
        tone: "money",
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    /* Constrained: a three-column grid stretched across 1400px leaves each input marooned
       at the far edge of its cell, which is what made this screen look broken. */
    <Card className="max-w-[620px]">
      <div className="flex items-start justify-between gap-4 border-b border-border px-4 py-3">
        <div>
          <h2>Discount ceilings</h2>
          <p className="mt-0.5 text-[12px] text-muted">
            The most a rep may discount before approval is needed. Services are deliberately strictest.
          </p>
        </div>
        {canEdit ? (
          <Button variant="primary" loading={busy} disabled={!dirty || invalid} onClick={save}>
            Save
          </Button>
        ) : null}
      </div>

      <div className="overflow-x-auto px-4 py-3">
        <table className="table">
          <thead>
            <tr>
              <th>Tier</th>
              {categories.map((c) => (
                <th key={c.id} className="num">
                  {c.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tiers.map((tier) => (
              <tr key={tier}>
                <td className="font-medium">{tier.charAt(0) + tier.slice(1).toLowerCase()}</td>
                {categories.map((c) => {
                  const key = `${tier}:${c.id}`;
                  const value = draft[key] ?? "";
                  const bad = value !== "" && (Number.isNaN(Number(value)) || Number(value) < 0 || Number(value) > 100);
                  return (
                    <td key={c.id} className="num">
                      <div className="relative inline-block">
                        <Input
                          numeric
                          dense
                          type="number"
                          min={0}
                          max={100}
                          step={0.5}
                          disabled={!canEdit}
                          className={cn("w-20 pr-6", bad && "border-danger text-danger")}
                          value={value}
                          placeholder="—"
                          onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
                          aria-label={`${tier} ${c.name} ceiling`}
                        />
                        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-muted">%</span>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-[12px] text-muted">
          An empty cell means no discount is allowed for that combination, so any discount counts fully as an overage.
        </p>
      </div>
    </Card>
  );
}
