import { Tabs } from "@/components/ui/Tabs";

export function QuotationTabs({
  id,
  pendingApproval,
  openCounters,
  hasOrder,
}: {
  id: string;
  pendingApproval: boolean;
  openCounters: number;
  hasOrder: boolean;
}) {
  const base = `/quotations/${id}`;
  return (
    <Tabs
      className="mt-5"
      items={[
        {
          href: base,
          label: "Builder",
          exact: true,
          badge: openCounters > 0 ? <span className="pill bg-primary-soft text-primary">{openCounters}</span> : undefined,
        },
        {
          href: `${base}/approval`,
          label: "Approval & audit",
          badge: pendingApproval ? <span className="h-1.5 w-1.5 rounded-full bg-warn" aria-label="Pending" /> : undefined,
        },
        {
          href: `${base}/fulfillment`,
          label: "Fulfillment",
          badge: hasOrder ? <span className="h-1.5 w-1.5 rounded-full bg-money" aria-label="Order exists" /> : undefined,
        },
        { href: `${base}/billing`, label: "Billing" },
      ]}
    />
  );
}
