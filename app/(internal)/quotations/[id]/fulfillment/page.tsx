import type { Metadata } from "next";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata: Metadata = { title: "Fulfillment" };

export default function FulfillmentPage() {
  return <EmptyState title="Fulfillment arrives in Phase P3" description="Warehouse split plans, manual override, shipments, backorders and simulated stock arrival." />;
}
