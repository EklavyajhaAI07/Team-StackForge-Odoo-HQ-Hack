"use client";

import { Card } from "@/components/ui/Card";
import { NumberTicker } from "@/components/ui/NumberTicker";
import { RiskArc } from "@/components/ui/RiskArc";

/**
 * The risk rail from the quotation builder, lifted onto the landing page unchanged.
 *
 * These are the real components rather than a picture of them, so what a visitor sees here
 * is what the builder renders — and it cannot drift out of date the way a screenshot would.
 * A client component because NumberTicker takes a format function, which a server component
 * cannot hand across the boundary.
 */
export function Vignette() {
  return (
    <div aria-hidden className="select-none">
      <Card className="px-6 py-7">
        {/* Zero over the ceiling: the calm state, so the page opens in mint rather than coral. */}
        <RiskArc value={0} managerMax={3} financeMax={5} />

        <div className="mt-6 flex items-baseline justify-between border-t border-border pt-5">
          <span className="text-[13px] text-muted">Live margin</span>
          <NumberTicker value={45.7} format={(n) => `${n.toFixed(1)}%`} className="display text-[26px] text-money" />
        </div>
      </Card>
      <p className="mt-3 text-center text-[12px] text-muted">The live risk &amp; margin rail from the quotation builder.</p>
    </div>
  );
}
