// Shared quotation math used by list pages, the builder, the portal and the seed.

export type LineForTotals = {
  qty: number;
  unitPrice: number;
  discountPct: number;
  product: { taxPct: number };
};

export function lineNet(l: { qty: number; unitPrice: number; discountPct: number }): number {
  return Math.round(l.qty * l.unitPrice * (1 - l.discountPct / 100));
}

export function lineTax(l: LineForTotals): number {
  return Math.round((lineNet(l) * l.product.taxPct) / 100);
}

export type Totals = { list: number; discount: number; net: number; tax: number; total: number };

export function quotationTotals(lines: LineForTotals[]): Totals {
  let list = 0;
  let net = 0;
  let tax = 0;
  for (const l of lines) {
    list += l.qty * l.unitPrice;
    const n = lineNet(l);
    net += n;
    tax += Math.round((n * l.product.taxPct) / 100);
  }
  return { list, discount: list - net, net, tax, total: net + tax };
}

/** Next quotation number: Q-<year>-<4 digits>, continuing after the highest existing one. */
export function nextQuotationNumber(existing: string[], year = new Date().getFullYear()): string {
  let max = 0;
  for (const n of existing) {
    const m = /^Q-(\d{4})-(\d+)$/.exec(n);
    if (m && Number(m[1]) === year) max = Math.max(max, Number(m[2]));
  }
  return `Q-${year}-${String(max + 1).padStart(4, "0")}`;
}

export const PIPELINE_COLUMNS: { key: string; label: string; statuses: string[] }[] = [
  { key: "draft", label: "Draft", statuses: ["DRAFT"] },
  { key: "pending", label: "Pending approval", statuses: ["PENDING_MANAGER", "PENDING_FINANCE"] },
  { key: "approved", label: "Approved / Sent", statuses: ["APPROVED", "SENT"] },
  { key: "negotiation", label: "Under negotiation", statuses: ["UNDER_NEGOTIATION"] },
  { key: "confirmed", label: "Confirmed", statuses: ["CONFIRMED"] },
];
