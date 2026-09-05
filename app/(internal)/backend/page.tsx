import type { Metadata } from "next";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata: Metadata = { title: "Backend" };

export default function BackendPage() {
  return (
    <>
      <h1>Backend</h1>
      <p className="mt-1 text-[13px] text-muted">Products, price lists, discount policy, approval thresholds, warehouses, plans.</p>
      <EmptyState className="mt-6" title="Configuration hub arrives with Phase P2" description="Plain CRUD screens, built right after the quotation builder." />
    </>
  );
}
