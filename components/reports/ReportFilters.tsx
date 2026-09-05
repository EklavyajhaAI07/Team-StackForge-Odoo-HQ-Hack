"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useTransition } from "react";
import { Field, Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { APPROVAL_FILTERS, PERIODS, isDefaultFilters, type ReportFilters as Filters } from "@/lib/report-filters";

/** Filters live in the URL, so a filtered report can be shared, reloaded and printed. */
export function ReportFilters({
  filters,
  reps,
  categories,
  products,
}: {
  filters: Filters;
  reps: { id: string; name: string }[];
  categories: { id: string; name: string }[];
  products: { id: string; name: string; categoryId: string }[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  // Narrowing the category narrows the product list too, so the two filters stay coherent.
  const visibleProducts = useMemo(
    () => (filters.category === "all" ? products : products.filter((p) => p.categoryId === filters.category)),
    [filters.category, products],
  );

  function set(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value === "all" || value === "") next.delete(key);
    else next.set(key, value);
    if (key === "category") next.delete("product"); // a stale product would contradict the new category
    startTransition(() => router.push(`/reports?${next.toString()}`, { scroll: false }));
  }

  const isFiltered = !isDefaultFilters(filters);

  return (
    <div className="no-print mb-3 flex flex-wrap items-end gap-2.5">
      <div className="flex flex-wrap items-end gap-2.5 [&>div]:w-[168px]">
        <Field label="Period">
          <Select dense value={filters.period} onChange={(e) => set("period", e.target.value)} disabled={pending}>
            {PERIODS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </Select>
        </Field>
        {/* Reps are scoped to their own quotations, so the picker only appears for the team-wide roles. */}
        {reps.length > 0 ? (
          <Field label="Rep">
            <Select dense value={filters.repId} onChange={(e) => set("rep", e.target.value)} disabled={pending}>
              <option value="all">Whole team</option>
              {reps.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}
        <Field label="Approval status">
          <Select dense value={filters.approval} onChange={(e) => set("approval", e.target.value)} disabled={pending}>
            {APPROVAL_FILTERS.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Category">
          <Select dense value={filters.category} onChange={(e) => set("category", e.target.value)} disabled={pending}>
            <option value="all">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Product">
          <Select dense value={filters.product} onChange={(e) => set("product", e.target.value)} disabled={pending}>
            <option value="all">All products</option>
            {visibleProducts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      {/* Sits on the same baseline as the selects rather than orphaned on its own row. */}
      {isFiltered ? (
        <Button size="sm" variant="ghost" onClick={() => startTransition(() => router.push("/reports", { scroll: false }))}>
          Clear filters
        </Button>
      ) : null}
    </div>
  );
}
