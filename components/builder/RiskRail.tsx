"use client";

import { Card } from "@/components/ui/Card";
import { NumberTicker } from "@/components/ui/NumberTicker";
import { RiskArc } from "@/components/ui/RiskArc";
import type { RiskResult } from "@/lib/engine/risk";
import type { RoutingDecision } from "@/lib/engine/routing";
import { formatMoney, formatPct } from "@/lib/money";
import type { Totals } from "@/lib/quotes";
import { cn } from "@/lib/cn";
import { PrimaryAction } from "./PrimaryAction";
import { UpsellPanel } from "./UpsellPanel";
import type { BuilderConfig, BuilderPermissions, BuilderQuotation, CatalogItem, UpsellItem } from "./types";

export function RiskRail({
  quotation,
  risk,
  totals,
  decision,
  config,
  upsell,
  catalog,
  permissions,
  portalUrl,
  lineCount,
  onAddUpsell,
}: {
  quotation: BuilderQuotation;
  risk: RiskResult;
  totals: Totals;
  decision: RoutingDecision;
  config: BuilderConfig;
  upsell: UpsellItem[];
  catalog: CatalogItem[];
  permissions: BuilderPermissions;
  portalUrl: string | null;
  lineCount: number;
  onAddUpsell: (item: CatalogItem) => Promise<void>;
}) {
  const overLines = risk.perLine.filter((p) => p.overage > 0);
  const marginTone = risk.marginPct < 0 ? "text-danger" : risk.marginPct < 15 ? "text-warn" : "text-money";

  return (
    <div className="sticky top-[76px] flex flex-col gap-4">
      <Card className="border-border-strong">
        <div className="flex flex-col items-center px-5 pt-5">
          <RiskArc value={risk.blended} managerMax={config.managerBlendedMaxPts} financeMax={config.financeLineOveragePts} />
        </div>

        <div className="mx-5 mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4">
          <div>
            <p className="text-[13px] text-muted">Live margin</p>
            <p className={cn("display mt-0.5 text-[26px] font-semibold", marginTone)}>
              <NumberTicker value={risk.marginPct} format={(n) => formatPct(n)} />
            </p>
          </div>
          <div className="text-right">
            <p className="text-[13px] text-muted">Order total</p>
            <p className="display mt-0.5 text-[26px] font-semibold">
              <NumberTicker value={totals.total} format={(n) => formatMoney(Math.round(n), { whole: true, currency: quotation.currency })} />
            </p>
          </div>
        </div>

        <div className="mx-5 mt-4 border-t border-border pt-4">
          <p className="text-[13px] text-muted">Per-line policy</p>
          {lineCount === 0 ? (
            <p className="mt-1 text-[14px] text-muted">Add lines to see ceilings.</p>
          ) : overLines.length === 0 ? (
            <p className="mt-1 text-[14px] text-money">All lines are within their ceilings.</p>
          ) : (
            <ul className="mt-2 flex flex-col gap-1.5">
              {overLines.map((p) => (
                <li key={p.lineId} className="flex items-start gap-2 rounded-[8px] bg-danger-soft px-2.5 py-1.5 text-[13px] text-danger">
                  <span className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full bg-danger" />
                  <span>
                    <span className="font-medium">{p.name}</span>: <span className="num">{p.overage.toFixed(1)}</span> pts over its{" "}
                    <span className="num">{p.ceiling}%</span> ceiling
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mx-5 mt-4 border-t border-border pt-4 pb-5">
          <p className="text-[13px] text-muted">Routing</p>
          <p className="mt-1 text-[14px]">
            {decision.kind === "AUTO_APPROVED"
              ? "Within policy — no approval needed."
              : decision.kind === "MANAGER"
                ? `Manager sign-off: ${decision.reason}.`
                : `Manager, then finance: ${decision.reason}.`}
          </p>
          <div className="mt-3">
            <PrimaryAction quotation={quotation} decision={decision} permissions={permissions} portalUrl={portalUrl} lineCount={lineCount} />
          </div>
        </div>
      </Card>

      <UpsellPanel currency={quotation.currency} items={upsell} catalog={catalog} canAdd={permissions.canEdit} onAdd={onAddUpsell} />
    </div>
  );
}
