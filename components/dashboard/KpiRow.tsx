"use client";

import { NumberTicker } from "@/components/ui/NumberTicker";
import { formatMoneyCompact, formatPct } from "@/lib/money";
import type { Kpis } from "@/lib/services/dashboard";

export function KpiRow({ kpis }: { kpis: Kpis }) {
  const marginTone = kpis.avgMarginPct < 15 ? "text-warn" : "text-money";
  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <Tile label="Open pipeline value" hint="Everything not yet confirmed or rejected">
        <NumberTicker value={kpis.openPipelineValue} format={(n) => formatMoneyCompact(Math.round(n))} className="display text-[30px] font-semibold" />
      </Tile>
      <Tile label="Average margin" hint="Revenue-weighted across open quotations">
        <NumberTicker value={kpis.avgMarginPct} format={(n) => formatPct(n)} className={`display text-[30px] font-semibold ${marginTone}`} />
      </Tile>
      <Tile label="Pending approvals" hint="Waiting on a manager or finance">
        <NumberTicker
          value={kpis.pendingApprovals}
          format={(n) => String(Math.round(n))}
          className={`display text-[30px] font-semibold ${kpis.pendingApprovals > 0 ? "text-warn" : ""}`}
        />
      </Tile>
      <Tile label="Confirmed this week" hint={`${formatMoneyCompact(kpis.confirmedThisWeekValue)} booked`}>
        <NumberTicker value={kpis.confirmedThisWeek} format={(n) => String(Math.round(n))} className="display text-[30px] font-semibold text-money" />
      </Tile>
    </div>
  );
}

function Tile({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="card px-4 py-3">
      <p className="text-[13px] text-muted">{label}</p>
      <div className="mt-1">{children}</div>
      <p className="mt-0.5 text-[11px] text-muted">{hint}</p>
    </div>
  );
}
