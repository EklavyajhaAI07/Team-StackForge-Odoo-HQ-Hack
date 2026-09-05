import type { Metadata } from "next";
import { requireSessionUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { getApprovalConfig, listCustomers, listQuotations } from "@/lib/queries";
import { quotationTotals } from "@/lib/quotes";
import { QuotationsHeader } from "@/components/quotations/QuotationsHeader";
import { QuotationsTable } from "@/components/quotations/QuotationsTable";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata: Metadata = { title: "Quotations" };

export default async function QuotationsPage() {
  const user = await requireSessionUser();
  const [quotations, customers, config] = await Promise.all([listQuotations(user), listCustomers(), getApprovalConfig()]);

  const rows = quotations.map((q) => ({
    id: q.id,
    number: q.number,
    company: q.customer.company,
    tier: q.customer.tier,
    rep: q.rep.name,
    status: q.status,
    total: quotationTotals(q.lines).total,
    blended: q.blendedRiskScore,
    maxLineOverage: q.maxLineOverage,
    lastActivityAt: q.lastActivityAt.toISOString(),
    lineCount: q.lines.length,
  }));

  return (
    <>
      <QuotationsHeader view="table" count={rows.length} customers={customers} scope={can(user, "quotations:all") ? "team" : "mine"}
        canCreate={can(user, "quotation:create")} />
      {rows.length === 0 ? (
        <EmptyState title="No quotations yet" description="Create one to see the pipeline." />
      ) : (
        <QuotationsTable rows={rows} managerMax={config.managerBlendedMaxPts} />
      )}
    </>
  );
}
