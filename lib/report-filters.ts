// Pure filter vocabulary for /reports. Deliberately free of any database or auth import so the
// client-side filter bar can use it without dragging server-only code into the browser bundle.
import type { QuoteStatus } from "@prisma/client";

export type Period = "7d" | "30d" | "90d" | "ytd" | "all";

export const PERIODS: { value: Period; label: string }[] = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "ytd", label: "Year to date" },
  { value: "all", label: "All time" },
];

export const DEFAULT_PERIOD: Period = "90d";

/** Approval status groups the report can filter by — plain words, not enum names. */
export const APPROVAL_FILTERS: { value: string; label: string; statuses: QuoteStatus[] }[] = [
  { value: "all", label: "Any approval status", statuses: [] },
  { value: "pending", label: "Awaiting approval", statuses: ["PENDING_MANAGER", "PENDING_FINANCE"] },
  { value: "approved", label: "Approved or sent", statuses: ["APPROVED", "SENT", "UNDER_NEGOTIATION"] },
  { value: "confirmed", label: "Confirmed", statuses: ["CONFIRMED"] },
  { value: "rejected", label: "Rejected", statuses: ["REJECTED"] },
  { value: "draft", label: "Draft", statuses: ["DRAFT"] },
];

export type ReportFilters = {
  period: Period;
  repId: string; // "all" | user id
  approval: string; // one of APPROVAL_FILTERS values
  category: string; // "all" | category id
  product: string; // "all" | product id
};

export function parseFilters(sp: Record<string, string | string[] | undefined>): ReportFilters {
  const one = (v: string | string[] | undefined, fallback: string) => (Array.isArray(v) ? (v[0] ?? fallback) : (v ?? fallback));
  const period = one(sp.period, DEFAULT_PERIOD) as Period;
  const approval = one(sp.approval, "all");
  return {
    period: PERIODS.some((p) => p.value === period) ? period : DEFAULT_PERIOD,
    repId: one(sp.rep, "all"),
    approval: APPROVAL_FILTERS.some((a) => a.value === approval) ? approval : "all",
    category: one(sp.category, "all"),
    product: one(sp.product, "all"),
  };
}

export function periodStart(period: Period, now = new Date()): Date | null {
  switch (period) {
    case "7d":
      return new Date(now.getTime() - 7 * 86_400_000);
    case "30d":
      return new Date(now.getTime() - 30 * 86_400_000);
    case "90d":
      return new Date(now.getTime() - 90 * 86_400_000);
    case "ytd":
      return new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
    case "all":
      return null;
  }
}

export function isDefaultFilters(f: ReportFilters): boolean {
  return f.period === DEFAULT_PERIOD && f.repId === "all" && f.approval === "all" && f.category === "all" && f.product === "all";
}
