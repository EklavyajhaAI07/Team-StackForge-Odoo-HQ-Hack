import type { Metadata } from "next";
import { requireSessionUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { loadDealHealth } from "@/lib/services/dashboard";
import { AlertColumns } from "@/components/dashboard/AlertColumns";
import { KpiRow } from "@/components/dashboard/KpiRow";
import { PageHeader } from "@/components/shell/PageHeader";
import { LiveList } from "@/components/shell/LiveList";

export const metadata: Metadata = { title: "Deal health" };

export default async function DashboardPage() {
  const user = await requireSessionUser();
  const { config, stalled, anomalies, slippage, kpis } = await loadDealHealth(user);
  const total = stalled.length + anomalies.length + slippage.length;

  return (
    <>
      <LiveList />
      <PageHeader
        title="Deal health"
        context={
          total === 0 ? "Nothing needs attention" : `${total} ${total === 1 ? "item needs" : "items need"} attention`
        }
      />
      <KpiRow kpis={kpis} />
      <div className="mt-5">
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
