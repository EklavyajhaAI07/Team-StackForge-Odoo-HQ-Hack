import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type Tone = "neutral" | "primary" | "money" | "warn" | "danger" | "info";

const toneClass: Record<Tone, string> = {
  neutral: "bg-neutral-soft text-muted",
  primary: "bg-primary-soft text-primary",
  money: "bg-money-soft text-money",
  warn: "bg-warn-soft text-warn",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
};

export function Pill({
  tone = "neutral",
  dot = false,
  className,
  children,
  title,
}: {
  tone?: Tone;
  dot?: boolean;
  className?: string;
  children: ReactNode;
  title?: string;
}) {
  return (
    <span className={cn("pill", dot && "pill-dot", toneClass[tone], className)} title={title}>
      {children}
    </span>
  );
}

/* ── Status mappings: color = meaning (§3.1) ── */

export const QUOTE_STATUS: Record<string, { label: string; tone: Tone }> = {
  DRAFT: { label: "Draft", tone: "neutral" },
  PENDING_MANAGER: { label: "Pending manager", tone: "warn" },
  PENDING_FINANCE: { label: "Pending finance", tone: "warn" },
  APPROVED: { label: "Approved", tone: "money" },
  SENT: { label: "Sent", tone: "info" },
  UNDER_NEGOTIATION: { label: "Under negotiation", tone: "primary" },
  CONFIRMED: { label: "Confirmed", tone: "money" },
  REJECTED: { label: "Rejected", tone: "danger" },
};

export const APPROVAL_STATUS: Record<string, { label: string; tone: Tone }> = {
  PENDING: { label: "Pending", tone: "warn" },
  APPROVED: { label: "Approved", tone: "money" },
  REJECTED: { label: "Rejected", tone: "danger" },
  RETURNED: { label: "Returned", tone: "info" },
};

export const ORDER_STATUS: Record<string, { label: string; tone: Tone }> = {
  CONFIRMED: { label: "Confirmed", tone: "money" },
  IN_FULFILLMENT: { label: "In fulfillment", tone: "info" },
  PARTIALLY_SHIPPED: { label: "Partially shipped", tone: "warn" },
  COMPLETED: { label: "Completed", tone: "money" },
};

export const SHIPMENT_STATUS: Record<string, { label: string; tone: Tone }> = {
  PLANNED: { label: "Planned", tone: "neutral" },
  SHIPPED: { label: "Shipped", tone: "info" },
  DELIVERED: { label: "Delivered", tone: "money" },
};

export const INVOICE_STATUS: Record<string, { label: string; tone: Tone }> = {
  DRAFT: { label: "Draft", tone: "neutral" },
  POSTED: { label: "Posted", tone: "warn" },
  PAID: { label: "Paid", tone: "money" },
};

export const TIER: Record<string, { label: string; tone: Tone }> = {
  BRONZE: { label: "Bronze", tone: "neutral" },
  SILVER: { label: "Silver", tone: "info" },
  GOLD: { label: "Gold", tone: "warn" },
};

export function StatusPill({
  status,
  map = QUOTE_STATUS,
  dot = true,
  className,
}: {
  status: string;
  map?: Record<string, { label: string; tone: Tone }>;
  dot?: boolean;
  className?: string;
}) {
  const m = map[status] ?? { label: status, tone: "neutral" as Tone };
  return (
    <Pill tone={m.tone} dot={dot} className={className}>
      {m.label}
    </Pill>
  );
}

export function TierPill({ tier, className }: { tier: string; className?: string }) {
  return <StatusPill status={tier} map={TIER} dot={false} className={className} />;
}
