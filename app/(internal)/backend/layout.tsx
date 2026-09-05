import { Tabs } from "@/components/ui/Tabs";
import { requireSessionUser } from "@/lib/auth";
import { can } from "@/lib/rbac";

export default async function BackendLayout({ children }: { children: React.ReactNode }) {
  const user = await requireSessionUser();
  const full = can(user, "config:all");

  return (
    <>
      <div className="mb-1">
        <h1>Backend</h1>
        <p className="mt-1 text-[13px] text-muted">
          {full
            ? "Everything the engines read at runtime: ceilings, thresholds, prices, stock and plans."
            : "You can set discount ceilings here. The remaining configuration is admin-only."}
        </p>
      </div>
      <Tabs
        className="mb-5"
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
