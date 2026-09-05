import { Tabs } from "@/components/ui/Tabs";
import { requireSessionUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { PageHeader } from "@/components/shell/PageHeader";

export default async function BackendLayout({ children }: { children: React.ReactNode }) {
  const user = await requireSessionUser();
  const full = can(user, "config:all");

  return (
    <>
      <PageHeader
        title="Backend"
        context={full ? "What the engines read at runtime" : "Discount ceilings only — the rest is admin-only"}
      />
      <Tabs
        className="mb-4"
        items={[
          { href: "/backend", label: "Discount policy", exact: true },
          { href: "/backend/approvals", label: "Approval thresholds" },
          { href: "/backend/products", label: "Products" },
          { href: "/backend/pricing", label: "Price lists" },
          { href: "/backend/warehouses", label: "Warehouses & stock" },
          { href: "/backend/plans", label: "Plans" },
          { href: "/backend/upsell", label: "Upsell pairs" },
        ]}
      />
      {children}
    </>
  );
}
