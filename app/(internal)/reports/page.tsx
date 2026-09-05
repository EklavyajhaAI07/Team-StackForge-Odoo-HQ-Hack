import type { Metadata } from "next";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata: Metadata = { title: "Reports" };

export default function ReportsPage() {
  return (
    <>
      <h1>Reports</h1>
      <p className="mt-1 text-[13px] text-muted">Filter by period, rep, approval status and product.</p>
      <EmptyState className="mt-6" title="Reports arrive in Phase P6" description="Filters, CSV export and the print stylesheet are built with the dashboard." />
    </>
  );
}
