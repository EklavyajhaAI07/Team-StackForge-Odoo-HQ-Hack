// Reports service (§6 /reports). Filters resolve to a Prisma query; the row shape is what
// both the table and the CSV export use, so the two can never drift.
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { computeRisk } from "@/lib/engine/risk";
import { quotationTotals } from "@/lib/quotes";
import { APPROVAL_FILTERS, periodStart, type ReportFilters } from "@/lib/report-filters";
import { getPolicyCeilings } from "./quotation";

export type ReportRow = {
  id: string;
  number: string;
  createdAt: string;
  company: string;
  tier: string;
  repName: string;
  /** What the customer is quoted in. Report money stays in the base currency so totals add up. */
  currencyCode: string;
  status: string;
  lineCount: number;
  units: number;
  listValue: number;
  discountValue: number;
  netValue: number;
  taxValue: number;
  totalValue: number;
  discountPct: number;
  marginPct: number;
  blendedRisk: number;
};

export type ReportTotals = {
  quotations: number;
  units: number;
  listValue: number;
  discountValue: number;
  netValue: number;
  taxValue: number;
  totalValue: number;
  avgDiscountPct: number;
  avgMarginPct: number;
};

export async function runReport(filters: ReportFilters) {
  const start = periodStart(filters.period);
  const approval = APPROVAL_FILTERS.find((a) => a.value === filters.approval);

  const where: Prisma.QuotationWhereInput = {};
  if (start) where.createdAt = { gte: start };
  if (filters.repId !== "all") where.repId = filters.repId;
  if (approval && approval.statuses.length) where.status = { in: approval.statuses };
  // A product or category filter keeps quotations that contain at least one matching line.
  if (filters.product !== "all") {
    where.lines = { some: { productId: filters.product } };
  } else if (filters.category !== "all") {
    where.lines = { some: { product: { categoryId: filters.category } } };
  }

  const [quotations, reps, categories, products] = await Promise.all([
    prisma.quotation.findMany({
      where,
      include: {
        customer: { select: { company: true, tier: true } },
        rep: { select: { id: true, name: true } },
        lines: { include: { product: { select: { taxPct: true, cost: true, categoryId: true } } } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.findMany({ where: { role: { in: ["SALES_REP", "SALES_MANAGER", "ADMIN"] } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.category.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.product.findMany({ select: { id: true, name: true, categoryId: true }, orderBy: { name: "asc" } }),
  ]);

  // Ceilings are per tier, so fetch each tier once rather than per quotation.
  const tiers = [...new Set(quotations.map((q) => q.customer.tier))];
  const ceilingsByTier = new Map(await Promise.all(tiers.map(async (t) => [t, await getPolicyCeilings(prisma, t)] as const)));

  const rows: ReportRow[] = quotations.map((q) => {
    const totals = quotationTotals(q.lines);
    const ceilings = ceilingsByTier.get(q.customer.tier);
    const risk = computeRisk(
      q.lines.map((l) => ({
        lineId: l.id,
        qty: l.qty,
        discountPct: l.discountPct,
        effectiveList: l.unitPrice,
        cost: l.product.cost,
        ceilingPct: ceilings?.get(l.product.categoryId) ?? 0,
      })),
    );
    return {
      id: q.id,
      number: q.number,
      createdAt: q.createdAt.toISOString(),
      company: q.customer.company,
      tier: q.customer.tier,
      repName: q.rep.name,
      currencyCode: q.currencyCode,
      status: q.status,
      lineCount: q.lines.length,
      units: q.lines.reduce((s, l) => s + l.qty, 0),
      listValue: totals.list,
      discountValue: totals.discount,
      netValue: totals.net,
      taxValue: totals.tax,
      totalValue: totals.total,
      discountPct: totals.list > 0 ? Math.round((totals.discount / totals.list) * 1000) / 10 : 0,
      marginPct: risk.marginPct,
      blendedRisk: risk.blended,
    };
  });

  const listValue = rows.reduce((s, r) => s + r.listValue, 0);
  const netValue = rows.reduce((s, r) => s + r.netValue, 0);
  const discountValue = rows.reduce((s, r) => s + r.discountValue, 0);
  // Averages are revenue-weighted, so one tiny quote cannot swing the number.
  const weightedMargin = rows.reduce((s, r) => s + (r.marginPct * r.netValue) / 100, 0);

  const totals: ReportTotals = {
    quotations: rows.length,
    units: rows.reduce((s, r) => s + r.units, 0),
    listValue,
    discountValue,
    netValue,
    taxValue: rows.reduce((s, r) => s + r.taxValue, 0),
    totalValue: rows.reduce((s, r) => s + r.totalValue, 0),
    avgDiscountPct: listValue > 0 ? Math.round((discountValue / listValue) * 1000) / 10 : 0,
    avgMarginPct: netValue > 0 ? Math.round((weightedMargin / netValue) * 1000) / 10 : 0,
  };

  return { rows, totals, reps, categories, products };
}
