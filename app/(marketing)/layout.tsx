import type { Metadata } from "next";
import "../globals.css";
import { fontClassNames } from "../fonts";

export const metadata: Metadata = {
  title: "DealFlow360 — self-governing B2B sales operations",
  description:
    "A quotation from first line to final payment: discount policy enforced per line, fulfillment split across warehouses, hybrid billing reconciled, and customers negotiating live. Every action audited.",
};

/**
 * The public realm. It borrows the internal dark theme rather than the portal's light one,
 * because this page is the front door to the workspace, not a customer document.
 *
 * `landing` on <html> is what scopes smooth anchor scrolling to this page alone.
 */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="internal" className={`${fontClassNames} landing h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
