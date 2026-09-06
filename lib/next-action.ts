// What this quotation is waiting for, from the point of view of the person looking at it.
//
// Pure, like the engines: status and viewer in, a label and a destination out. It decides
// nothing on its own — every action it points at is re-authorised by the route that performs
// it — so this is navigation, not a second copy of the rules.

import { can } from "./rbac";
import type { Actor } from "./rbac";

export type NextAction = {
  label: string;
  href: string;
  /** True when this viewer is the one holding the deal up. */
  urgent: boolean;
};

export function nextAction(
  quotation: { id: string; status: string; repId: string; openCounters?: number },
  viewer: Actor,
): NextAction {
  const base = `/quotations/${quotation.id}`;
  const owns = quotation.repId === viewer.id;

  switch (quotation.status) {
    case "DRAFT":
      return { label: owns ? "Continue" : "Open", href: base, urgent: false };

    case "PENDING_MANAGER": {
      // A rep cannot approve their own quotation, so for them this is only ever a view.
      const mine = can(viewer, "approval:manager") && !owns;
      return { label: mine ? "Review" : "View", href: `${base}/approval`, urgent: mine };
    }

    case "PENDING_FINANCE": {
      const mine = can(viewer, "approval:finance") && !owns;
      return { label: mine ? "Review" : "View", href: `${base}/approval`, urgent: mine };
    }

    case "APPROVED":
      // Approved and not yet with the customer: the next move is to send it.
      return { label: can(viewer, "quotation:send", { repId: quotation.repId }) ? "Send" : "Open", href: base, urgent: false };

    case "UNDER_NEGOTIATION":
      return {
        label: quotation.openCounters ? "Answer" : "Open",
        href: base,
        urgent: Boolean(quotation.openCounters) && (owns || can(viewer, "quotations:all")),
      };

    case "SENT":
      return { label: "Open", href: base, urgent: false };

    case "CONFIRMED":
      return { label: "Fulfil", href: `${base}/fulfillment`, urgent: false };

    case "REJECTED":
      return { label: owns ? "Revise" : "Open", href: base, urgent: false };

    default:
      return { label: "Open", href: base, urgent: false };
  }
}
