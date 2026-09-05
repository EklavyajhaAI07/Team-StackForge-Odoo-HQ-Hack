import type { Metadata } from "next";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata: Metadata = { title: "Billing" };

export default function BillingPage() {
  return <EmptyState title="Billing arrives in Phase P4" description="One-time invoice, recurring schedule, proration and payments." />;
}
