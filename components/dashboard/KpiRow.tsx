"use client";

import { NumberTicker } from "@/components/ui/NumberTicker";
import { formatMoneyCompact, formatPct } from "@/lib/money";
import type { Kpis } from "@/lib/services/dashboard";

/**
 * Four figures across the top. They share one row and one border, so they read as a
 * single strip of instrumentation rather than four cards that happen to sit together.
 */
export function KpiRow({ kpis }: { kpis: Kpis }) {
  const marginTone = kpis.avgMarginPct < 15 ? "text-warn" : "text-money";
  return (
    <div className="card grid grid-cols-2 divide-x divide-border overflow-hidden xl:grid-cols-4">
      <Tile label="Open pipeline" hint="Not yet confirmed or rejected">
        <NumberTicker value={kpis.openPipelineValue} format={(n) => formatMoneyCompact(Math.round(n))} className="display text-[30px]" />
      </Tile>
      <Tile label="Average margin" hint="Revenue-weighted across open quotations">
        <NumberTicker value={kpis.avgMarginPct} format={(n) => formatPct(n)} className={`display text-[30px] ${marginTone}`} />
      </Tile>
      <Tile label="Pending approvals" hint="Waiting on a manager or finance">
        <NumberTicker
          value={kpis.pendingApprovals}
          format={(n) => String(Math.round(n))}
          className={`display text-[30px] ${kpis.pendingApprovals > 0 ? "text-warn" : "text-muted"}`}
        />
      </Tile>
      <Tile label="Confirmed this week" hint={`${formatMoneyCompact(kpis.confirmedThisWeekValue)} booked`}>
        <NumberTicker value={kpis.confirmedThisWeek} format={(n) => String(Math.round(n))} className="display text-[30px] text-money" />
      </Tile>
    </div>
  );
}

function Tile({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="px-4 py-3">
      <p className="text-[13px] text-muted">{label}</p>
      <div className="mt-1.5">{children}</div>
      <p className="mt-1 text-[12px] text-faint">{hint}</p>
    </div>
  );
}
