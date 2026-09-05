// Human copy for the audit timeline. Sentence case, says what happened (§3.6).
import { formatMoney } from "./money";

type Meta = Record<string, unknown> | null | undefined;

const LABELS: Record<string, string> = {
  created: "Created the quotation",
  "line-added": "Added a line",
  "line-updated": "Updated a line",
  "line-removed": "Removed a line",
  "order-discount-applied": "Applied an order-level discount",
  "sent-for-approval": "Sent for approval",
  "auto-approved: within policy": "Auto-approved — within policy",
  "re-entered approval: terms changed": "Re-entered approval — terms changed",
  approved: "Approved",
  rejected: "Rejected",
  returned: "Returned for revision",
  reopened: "Reopened as draft",
  "sent-to-customer": "Sent to the customer",
  "counter-proposed": "Customer proposed a change",
  "customer-comment": "Customer left a comment",
  "counter-accepted": "Accepted the customer's counter",
  "counter-declined": "Declined the customer's counter",
  "rep-replied": "Replied to the customer",
  confirmed: "Confirmed the quotation",
  "confirm-blocked": "Customer tried to confirm while terms were under approval",
  "order-created": "Order created",
  "split-accepted": "Accepted the suggested warehouse split",
  "split-overridden": "Applied a manual warehouse override",
  "stock-arrived": "Simulated stock arrival",
  "backorder-consolidated": "Consolidated the backorder",
  "reorder-point-reached": "Stock reached a reorder point",
  "shipment-status": "Updated a shipment",
  "invoice-generated": "Generated a recurring invoice",
  "payment-recorded": "Recorded a payment",
  "qty-changed": "Changed a subscription quantity",
  "subscription-cancelled": "Cancelled a subscription line",
  nudge: "Nudged the rep",
  "config-updated": "Updated configuration",
};

export function auditLabel(action: string): string {
  return LABELS[action] ?? action.charAt(0).toUpperCase() + action.slice(1).replace(/-/g, " ");
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** One-line detail built from meta — never dumps raw JSON at the reader. */
export function auditDetail(action: string, meta: Meta): string | null {
  if (!meta) return null;
  const m = meta as Record<string, unknown>;
  const parts: string[] = [];

  if (typeof m.product === "string") {
    const qty = num(m.qty);
    const disc = num(m.discountPct);
    const qtyChange = m.qty && typeof m.qty === "object" ? (m.qty as { from: number; to: number }) : null;
    const discChange = m.discountPct && typeof m.discountPct === "object" ? (m.discountPct as { from: number; to: number }) : null;
    let s = m.product;
    if (qtyChange) s += ` · qty ${qtyChange.from} → ${qtyChange.to}`;
    else if (qty != null) s += ` × ${qty}`;
    if (discChange) s += ` · discount ${discChange.from}% → ${discChange.to}%`;
    else if (disc != null && disc > 0) s += ` at ${disc}%`;
    parts.push(s);
  }
  if (typeof m.customer === "string" && action === "created") parts.push(`for ${m.customer}${typeof m.tier === "string" ? ` (${m.tier.toLowerCase()})` : ""}`);
  if (typeof m.pct === "number" && action === "order-discount-applied") parts.push(`${m.pct}% on ${m.lines} lines`);
  if (Array.isArray(m.steps) && m.steps.length) parts.push(`route: ${(m.steps as string[]).map((s) => (s === "SALES_MANAGER" ? "manager" : "finance")).join(" → ")}`);
  if (typeof m.reason === "string" && m.reason) parts.push(m.reason);
  const blended = num(m.blended);
  const maxOver = num(m.maxLineOverage);
  if (blended != null && (action.includes("approv") || action.includes("re-entered") || action === "sent-for-approval")) {
    parts.push(`blended ${blended.toFixed(1)} pts · worst line ${(maxOver ?? 0).toFixed(1)} pts over`);
  }
  if (typeof m.trigger === "string" && m.trigger !== "submit") parts.push(`triggered by ${m.trigger === "counter" ? "an accepted customer counter" : "a line edit"}`);
  if (Array.isArray(m.voided) && m.voided.length) parts.push(`${m.voided.length} earlier approval step${m.voided.length === 1 ? "" : "s"} voided`);
  if (typeof m.line === "string" && num(m.counterDiscountPct) != null) parts.push(`${m.line}: asked for ${m.counterDiscountPct}%`);
  if (typeof m.plan === "string") parts.push(m.plan);
  if (num(m.amount) != null && (action === "payment-recorded" || action === "invoice-generated")) parts.push(formatMoney(m.amount as number));
  if (typeof m.via === "string") parts.push(`via ${m.via}`);
  if (typeof m.step === "number" && action === "approved") parts.unshift(`step ${m.step} (${m.role === "FINANCE" ? "finance" : "manager"})`);
  if (typeof m.message === "string") parts.push(m.message);
  if (typeof m.warehouse === "string") parts.push(m.warehouse);

  return parts.length ? parts.join(" — ") : null;
}
