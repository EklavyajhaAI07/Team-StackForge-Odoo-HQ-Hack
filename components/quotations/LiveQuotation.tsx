"use client";

import { useCallback } from "react";
import { useQuoteEvents, type QuoteEvent } from "@/components/hooks/useQuoteEvents";
import { useToast } from "@/components/ui/Toast";
import { QUOTE_STATUS } from "@/components/ui/Pill";

/** Copy for each event the rep can receive while looking at a quotation. */
function describe(event: QuoteEvent): { title: string; description?: string; tone: "primary" | "money" | "warn" | "info" } | null {
  const p = event.payload ?? {};
  const line = typeof p.line === "string" ? p.line : null;
  const pct = typeof p.counterDiscountPct === "number" ? p.counterDiscountPct : null;
  const status = typeof p.status === "string" ? (QUOTE_STATUS[p.status]?.label ?? p.status) : null;

  switch (event.type) {
    case "counter-proposed":
      return {
        title: line && pct != null ? `Customer countered ${pct}% on ${line}` : "Customer proposed a change",
        description: "Review it in the requested changes panel.",
        tone: "primary",
      };
    case "customer-comment":
      return { title: line ? `Customer commented on ${line}` : "Customer left a comment", description: typeof p.body === "string" ? p.body : undefined, tone: "info" };
    case "confirm-blocked":
      return { title: "Customer tried to confirm", description: "Their requested terms are still with approvals.", tone: "warn" };
    case "status-changed":
      return status === "Confirmed"
        ? { title: "Customer confirmed the quotation", description: "The order and its invoices are ready.", tone: "money" }
        : { title: status ? `Status is now ${status.toLowerCase()}` : "Status changed", tone: "info" };
    case "counter-answered":
      return { title: "Requested change answered", description: status ? `Now ${status.toLowerCase()}.` : undefined, tone: "primary" };
    case "fulfillment-changed":
      return { title: "Fulfillment updated", tone: "info" };
    case "billing-changed":
      return { title: "Billing updated", tone: "money" };
    default:
      return null;
  }
}

/**
 * Mounted once per quotation. Keeps the server components fresh over SSE (with a 3s poll
 * fallback) and raises a toast for anything the customer does.
 */
export function LiveQuotation({ quotationId }: { quotationId: string }) {
  const { toast } = useToast();
  const onEvent = useCallback(
    (event: QuoteEvent) => {
      const copy = describe(event);
      if (copy) toast(copy);
    },
    [toast],
  );
  useQuoteEvents(quotationId, onEvent);
  return null;
}
