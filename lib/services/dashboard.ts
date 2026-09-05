// Deal-health service (§5.6). The statistics live in lib/engine/anomaly.ts as pure functions;
// this module only resolves rows and shapes them for the screen.
import { prisma } from "@/lib/db";
import { flagDiscountAnomalies, isSlipping, isStalled, repDiscountStats, weightedAvgDiscount } from "@/lib/engine/anomaly";
import { quotationTotals } from "@/lib/quotes";
import { getConfig } from "./quotation";

export type StalledCard = {
  quotationId: string;
  number: string;
  company: string;
  repName: string;
  status: string;
  total: number;
  daysIdle: number;
  lastActivityAt: string;
};

export type AnomalyCard = {
  quotationId: string;
  number: string;
  company: string;
  repName: string;
  quoteDiscountPct: number;
  repMean: number;
  repStd: number;
  threshold: number;
  total: number;
};

export type SlippageCard = {
  quotationId: string;
  orderId: string;
  number: string;
  company: string;
  repName: string;
  promisedDate: string;
  daysLate: number;
  undelivered: number;
};

export type Kpis = {
  openPipelineValue: number;
  avgMarginPct: number;
  pendingApprovals: number;
  confirmedThisWeek: number;
  confirmedThisWeekValue: number;
};

const OPEN_STATUSES = ["DRAFT", "PENDING_MANAGER", "PENDING_FINANCE", "APPROVED", "SENT", "UNDER_NEGOTIATION"];

export async function loadDealHealth(now = new Date()) {
  const config = await getConfig(prisma);

  const [quotations, orders, history] = await Promise.all([
    prisma.quotation.findMany({
      include: {
        customer: { select: { company: true } },
        rep: { select: { id: true, name: true } },
        lines: { include: { product: { select: { taxPct: true, cost: true } } } },
      },
      orderBy: { lastActivityAt: "asc" },
    }),
    prisma.order.findMany({
      include: {
        shipments: { select: { status: true } },
        quotation: {
          select: {
            id: true,
            number: true,
            customer: { select: { company: true } },
            rep: { select: { name: true } },
          },
        },
      },
    }),
    prisma.historicalOrder.findMany({ select: { repId: true, orderDiscountPct: true } }),
  ]);

  // ── Stalled ──────────────────────────────────────────────────────────────
  const stalled: StalledCard[] = quotations
    .filter((q) => isStalled({ status: q.status, lastActivityAt: q.lastActivityAt, stalledDays: config.stalledDays, now }))
    .map((q) => ({
      quotationId: q.id,
      number: q.number,
      company: q.customer.company,
      repName: q.rep.name,
      status: q.status,
      total: quotationTotals(q.lines).total,
      daysIdle: Math.floor((now.getTime() - q.lastActivityAt.getTime()) / 86_400_000),
      lastActivityAt: q.lastActivityAt.toISOString(),
    }))
    .sort((a, b) => b.daysIdle - a.daysIdle);

  // ── Discount anomalies ───────────────────────────────────────────────────
  const active = quotations.filter((q) => OPEN_STATUSES.includes(q.status) && q.lines.length > 0);
  const flags = flagDiscountAnomalies({
    quotes: active.map((q) => ({
      quotationId: q.id,
      repId: q.repId,
      weightedAvgDiscount: weightedAvgDiscount(q.lines),
    })),
    history,
    sigma: config.anomalySigma,
  });
  const byId = new Map(active.map((q) => [q.id, q]));
  const anomalies: AnomalyCard[] = flags
    .map((f) => {
      const q = byId.get(f.quotationId)!;
      return {
        quotationId: f.quotationId,
        number: q.number,
        company: q.customer.company,
        repName: q.rep.name,
        quoteDiscountPct: Math.round(f.quoteDiscountPct * 10) / 10,
        repMean: Math.round(f.repMean * 10) / 10,
        repStd: Math.round(f.repStd * 10) / 10,
        threshold: Math.round(f.threshold * 10) / 10,
        total: quotationTotals(q.lines).total,
      };
    })
    .sort((a, b) => b.quoteDiscountPct - a.quoteDiscountPct);

  // ── Delivery slippage ────────────────────────────────────────────────────
  const slippage: SlippageCard[] = orders
    .filter((o) => isSlipping({ promisedDate: o.promisedDate, shipments: o.shipments, now }))
    .map((o) => ({
      quotationId: o.quotation.id,
      orderId: o.id,
      number: o.quotation.number,
      company: o.quotation.customer.company,
      repName: o.quotation.rep.name,
      promisedDate: o.promisedDate!.toISOString(),
      daysLate: Math.floor((now.getTime() - o.promisedDate!.getTime()) / 86_400_000),
      undelivered: o.shipments.filter((s) => s.status !== "DELIVERED").length,
    }))
    .sort((a, b) => b.daysLate - a.daysLate);

  // ── KPI tickers ──────────────────────────────────────────────────────────
  const open = quotations.filter((q) => OPEN_STATUSES.includes(q.status));
  const openPipelineValue = open.reduce((s, q) => s + quotationTotals(q.lines).total, 0);

  let netRevenue = 0;
  let grossProfit = 0;
  for (const q of open) {
    for (const l of q.lines) {
      const net = l.qty * l.unitPrice * (1 - l.discountPct / 100);
      netRevenue += net;
      grossProfit += net - l.qty * l.product.cost;
    }
  }
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000);
  const confirmed = quotations.filter((q) => q.status === "CONFIRMED" && q.lastActivityAt >= weekAgo);

  const kpis: Kpis = {
    openPipelineValue,
    avgMarginPct: netRevenue > 0 ? Math.round((grossProfit / netRevenue) * 1000) / 10 : 0,
    pendingApprovals: quotations.filter((q) => q.status === "PENDING_MANAGER" || q.status === "PENDING_FINANCE").length,
    confirmedThisWeek: confirmed.length,
    confirmedThisWeekValue: confirmed.reduce((s, q) => s + quotationTotals(q.lines).total, 0),
  };

  // Rep averages power the anomaly copy ("Arjun's average discount is 9.1%").
  const repStats = repDiscountStats(history);

  return { config, stalled, anomalies, slippage, kpis, repStats: [...repStats.values()] };
}
