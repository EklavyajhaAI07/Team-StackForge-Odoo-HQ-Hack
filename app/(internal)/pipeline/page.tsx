import type { Metadata } from "next";
import Link from "next/link";
import { requireSessionUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { getApprovalConfig, listCustomers, listQuotations } from "@/lib/queries";
import { PIPELINE_COLUMNS, quotationTotals } from "@/lib/quotes";
import { formatMoney } from "@/lib/money";
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
            <section key={col.key} className="flex min-h-[420px] flex-col rounded-[12px] border border-border bg-surface/60">
              <header className="flex items-center justify-between px-3 pt-3 pb-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-[13px] font-semibold">{col.label}</h3>
                  <span className="pill bg-neutral-soft text-muted">{col.items.length}</span>
                </div>
                <span className="num text-[12px] text-muted">{formatMoney(value, { whole: true })}</span>
              </header>
              <div className="flex flex-1 flex-col gap-2 px-2 pb-2">
                {col.items.length === 0 ? (
                  <p className="px-1 py-3 text-[12px] text-muted">Nothing here yet.</p>
                ) : (
                  col.items.map((q) => {
                    const days = daysSince(q.lastActivityAt);
                    const stale = days > config.stalledDays && col.key !== "confirmed" && col.key !== "draft";
                    return (
                      <Link
                        key={q.id}
                        href={`/quotations/${q.id}`}
                        className="card block px-3 py-2.5 transition-colors hover:border-primary"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-[13px] font-medium">{q.customer.company}</span>
                          <TierPill tier={q.customer.tier} />
                        </div>
                        <div className="mt-1 flex items-center justify-between gap-2">
                          <span className="num text-[12px] text-muted">{q.number}</span>
                          <span className="num text-[13px]">{formatMoney(quotationTotals(q.lines).total, { whole: true })}</span>
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <RiskChip blended={q.blendedRiskScore} maxLineOverage={q.maxLineOverage} managerMax={config.managerBlendedMaxPts} />
                          <span className={stale ? "text-[12px] text-warn" : "text-[12px] text-muted"}>
                            {days === 0 ? "today" : `${days}d since activity`}
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
        <p className="mt-3 text-[12px] text-muted">
          {rejected} rejected quotation{rejected === 1 ? "" : "s"} not shown — find them in the table view.
        </p>
      ) : null}
    </>
  );
}
