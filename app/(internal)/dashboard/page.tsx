import type { Metadata } from "next";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <>
      <h1>Deal health</h1>
      <p className="mt-1 text-[13px] text-muted">Stalled deals, discount anomalies and delivery slippage.</p>
      <EmptyState className="mt-6" title="Deal health arrives in Phase P6" description="Alert columns and KPI tickers are built after billing and the portal loop." />
    </>
  );
}
