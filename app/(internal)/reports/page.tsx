import type { Metadata } from "next";
import { requireSessionUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { formatDate } from "@/lib/format";
import { APPROVAL_FILTERS, PERIODS, parseFilters } from "@/lib/report-filters";
import { runReport } from "@/lib/services/reports";
import { ReportFilters } from "@/components/reports/ReportFilters";
import { ReportTable } from "@/components/reports/ReportTable";
import { PageHeader } from "@/components/shell/PageHeader";

export const metadata: Metadata = { title: "Reports" };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireSessionUser();
  const sp = await searchParams;
  const filters = parseFilters(sp);

  // A rep sees only their own quotations; managers, finance and admin see the whole team.
  const scoped = can(user, "reports:all") ? filters : { ...filters, repId: user.id };
  const { rows, totals, reps, categories, products } = await runReport(scoped);

  const periodLabel = PERIODS.find((p) => p.value === scoped.period)?.label ?? "";
  const repLabel = scoped.repId === "all" ? "the whole team" : (reps.find((r) => r.id === scoped.repId)?.name ?? user.name);
  const approvalLabel = APPROVAL_FILTERS.find((a) => a.value === scoped.approval)?.label ?? "";
  const categoryLabel = scoped.category === "all" ? null : categories.find((c) => c.id === scoped.category)?.name;
  const productLabel = scoped.product === "all" ? null : products.find((p) => p.id === scoped.product)?.name;

  const summary = [
    `${periodLabel.toLowerCase()} for ${repLabel}`,
    approvalLabel.toLowerCase(),
    productLabel ?? categoryLabel,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <PageHeader
        title="Reports"
        context={`${totals.quotations} quotation${totals.quotations === 1 ? "" : "s"} · ${summary}`}
        actions={<p className="print-only text-[12px] text-muted">Generated {formatDate(new Date())}</p>}
      />
      <ReportFilters filters={scoped} reps={can(user, "reports:all") ? reps : []} categories={categories} products={products} />
      <ReportTable rows={rows} totals={totals} summary={summary} />
    </>
  );
}
