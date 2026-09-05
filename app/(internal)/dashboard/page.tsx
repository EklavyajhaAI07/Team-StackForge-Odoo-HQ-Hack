import type { Metadata } from "next";
import { requireSessionUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { loadDealHealth } from "@/lib/services/dashboard";
import { AlertColumns } from "@/components/dashboard/AlertColumns";
import { KpiRow } from "@/components/dashboard/KpiRow";

export const metadata: Metadata = { title: "Deal health" };

export default async function DashboardPage() {
  const user = await requireSessionUser();
  const { config, stalled, anomalies, slippage, kpis } = await loadDealHealth();
  const total = stalled.length + anomalies.length + slippage.length;

  return (
    <>
      <div className="mb-5">
        <h1>Deal health</h1>
        <p className="mt-1 text-[13px] text-muted">
          {total === 0
            ? "Nothing needs attention right now."
            : `${total} thing${total === 1 ? "" : "s"} need attention. Open a card to see the quotation, or nudge the rep.`}
        </p>
      </div>

      <KpiRow kpis={kpis} />

      <div className="mt-6">
        <AlertColumns
          stalled={stalled}
          anomalies={anomalies}
          slippage={slippage}
          stalledDays={config.stalledDays}
          sigma={config.anomalySigma}
          canNudge={can(user, "nudge")}
        />
      </div>
    </>
  );
}
