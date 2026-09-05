import type { Metadata } from "next";
import Link from "next/link";
import { requireSessionUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { getApprovalConfig, listCustomers, listQuotations } from "@/lib/queries";
import { PIPELINE_COLUMNS, quotationTotals } from "@/lib/quotes";
import { formatMoneyCompact } from "@/lib/money";
import { daysSince } from "@/lib/format";
import { QuotationsHeader } from "@/components/quotations/QuotationsHeader";
import { RiskChip } from "@/components/quotations/RiskChip";
import { TierPill } from "@/components/ui/Pill";

export const metadata: Metadata = { title: "Pipeline" };

export default async function PipelinePage() {
  const user = await requireSessionUser();
  const [quotations, customers, config] = await Promise.all([listQuotations(), listCustomers(), getApprovalConfig()]);

  const columns = PIPELINE_COLUMNS.map((col) => ({
    ...col,
    items: quotations.filter((q) => col.statuses.includes(q.status)),
  }));
  const rejected = quotations.filter((q) => q.status === "REJECTED").length;

  return (
    <>
      <QuotationsHeader view="kanban" count={quotations.length} customers={customers} canCreate={can(user, "quotation:create")} />
      <div className="grid grid-cols-5 gap-3">
        {columns.map((col) => {
          const value = col.items.reduce((s, q) => s + quotationTotals(q.lines).total, 0);
          return (
            <section key={col.key} className="flex flex-col">
              {/* Header is one line at a fixed height, so every column's cards start level. */}
              <header className="mb-2 flex h-6 items-center justify-between gap-2 px-0.5">
                <div className="flex min-w-0 items-center gap-1.5">
                  <h2 className="truncate text-[13px] font-medium text-text-dim">{col.label}</h2>
                  <span className="num text-[12px] text-faint">{col.items.length}</span>
                </div>
                <span className="num shrink-0 text-[12px] text-faint">{formatMoneyCompact(value)}</span>
              </header>

              <div className="flex flex-1 flex-col gap-2">
                {col.items.length === 0 ? (
                  <p className="rounded-[10px] border border-dashed border-border px-3 py-3 text-[13px] text-faint">Empty</p>
                ) : (
                  col.items.map((q) => {
                    const days = daysSince(q.lastActivityAt);
                    const stale = days > config.stalledDays && col.key !== "confirmed" && col.key !== "draft";
                    return (
                      <Link
                        key={q.id}
                        href={`/quotations/${q.id}`}
                        className="card block px-3 py-2.5 transition-colors hover:border-border-strong"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="truncate text-[14px] font-medium">{q.customer.company}</span>
                          <TierPill tier={q.customer.tier} />
                        </div>
                        <div className="mt-1.5 flex items-baseline justify-between gap-2">
                          <span className="num text-[12px] text-faint">{q.number}</span>
                          <span className="num text-[14px]">{formatMoneyCompact(quotationTotals(q.lines).total)}</span>
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-2 border-t border-border pt-2">
                          <RiskChip blended={q.blendedRiskScore} maxLineOverage={q.maxLineOverage} managerMax={config.managerBlendedMaxPts} />
                          <span className={stale ? "text-[12px] text-warn" : "text-[12px] text-faint"}>
                            {days === 0 ? "today" : `${days}d`}
                          </span>
                        </div>
                        <div className="mt-1.5 text-[12px] text-muted">{q.rep.name}</div>
                      </Link>
                    );
                  })
                )}
              </div>
            </section>
          );
        })}
      </div>
      {rejected > 0 ? (
        <p className="mt-4 text-[13px] text-faint">
          {rejected} rejected quotation{rejected === 1 ? "" : "s"} not shown — find them in the table view.
        </p>
      ) : null}
    </>
  );
}
