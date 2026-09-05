"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusPill } from "@/components/ui/Pill";
import { useToast } from "@/components/ui/Toast";
import { IconBell, IconClock, IconTruck } from "@/components/ui/icons";
import { formatDate, plural } from "@/lib/format";
import { formatMoney, formatPct } from "@/lib/money";
import type { AnomalyCard, SlippageCard, StalledCard } from "@/lib/services/dashboard";

export function AlertColumns({
  stalled,
  anomalies,
  slippage,
  stalledDays,
  sigma,
  canNudge,
}: {
  stalled: StalledCard[];
  anomalies: AnomalyCard[];
  slippage: SlippageCard[];
  stalledDays: number;
  sigma: number;
  canNudge: boolean;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <Column
        title="Stalled deals"
        icon={<IconClock size={15} />}
        tone="warn"
        count={stalled.length}
        caption={`No activity for more than ${plural(stalledDays, "day")}`}
        empty="Every open quotation has moved recently."
      >
        {stalled.map((s) => (
          <AlertCard
            key={s.quotationId}
            href={`/quotations/${s.quotationId}`}
            quotationId={s.quotationId}
            canNudge={canNudge}
            title={s.company}
            number={s.number}
            headline={
              <span className="text-warn">
                Idle for <span className="num">{s.daysIdle}</span> days
              </span>
            }
            detail={`${s.repName} · last touched ${formatDate(s.lastActivityAt)}`}
            right={
              <>
                <StatusPill status={s.status} />
                <span className="num mt-1 block text-[13px] text-muted">{formatMoney(s.total, { whole: true })}</span>
              </>
            }
          />
        ))}
      </Column>

      <Column
        title="Discount anomalies"
        icon={<IconBell size={15} />}
        tone="danger"
        count={anomalies.length}
        caption={`Above the rep's own average plus ${sigma}σ`}
        empty="No rep is discounting unusually deeply."
      >
        {anomalies.map((a) => (
          <AlertCard
            key={a.quotationId}
            href={`/quotations/${a.quotationId}`}
            quotationId={a.quotationId}
            canNudge={canNudge}
            title={a.company}
            number={a.number}
            headline={
              <span className="text-danger">
                {a.repName}&rsquo;s average discount is <span className="num">{formatPct(a.repMean)}</span> — this quote is at{" "}
                <span className="num">{formatPct(a.quoteDiscountPct)}</span>
              </span>
            }
            detail={`Flags above ${formatPct(a.threshold)} for this rep`}
            right={<span className="num text-[13px] text-muted">{formatMoney(a.total, { whole: true })}</span>}
          />
        ))}
      </Column>

      <Column
        title="Delivery slippage"
        icon={<IconTruck size={15} />}
        tone="danger"
        count={slippage.length}
        caption="Promised date passed with a shipment still out"
        empty="Nothing is running late."
      >
        {slippage.map((s) => (
          <AlertCard
            key={s.orderId}
            href={`/quotations/${s.quotationId}/fulfillment`}
            quotationId={s.quotationId}
            canNudge={canNudge}
            title={s.company}
            number={s.number}
            headline={
              <span className="text-danger">
                <span className="num">{s.daysLate}</span> days past the promised date
              </span>
            }
            detail={`${s.repName} · promised ${formatDate(s.promisedDate)} · ${plural(s.undelivered, "shipment")} still out`}
            right={null}
          />
        ))}
      </Column>
    </div>
  );
}

function Column({
  title,
  icon,
  tone,
  count,
  caption,
  empty,
  children,
}: {
  title: string;
  icon: ReactNode;
  tone: "warn" | "danger";
  count: number;
  caption: string;
  empty: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col">
      {/* The count belongs beside the title it counts, not pinned to the far edge of the column. */}
      <header className="mb-2">
        <div className="flex items-center gap-2">
          <span className={count === 0 ? "text-faint" : tone === "warn" ? "text-warn" : "text-danger"}>{icon}</span>
          <h2>{title}</h2>
          <span className="num text-[13px] text-faint">{count}</span>
        </div>
        <p className="mt-0.5 text-[13px] text-muted">{caption}</p>
      </header>
      {count === 0 ? <EmptyState compact title="All clear" description={empty} /> : <div className="flex flex-col gap-2">{children}</div>}
    </section>
  );
}

function AlertCard({
  href,
  quotationId,
  canNudge,
  title,
  number,
  headline,
  detail,
  right,
}: {
  href: string;
  quotationId: string;
  canNudge: boolean;
  title: string;
  number: string;
  headline: ReactNode;
  detail: string;
  right: ReactNode;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  async function nudge() {
    setBusy(true);
    try {
      const res = await fetch(`/api/quotations/${quotationId}/nudge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Flagged on the deal-health dashboard" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: data.error ?? "Could not send the nudge", tone: "danger" });
        return;
      }
      toast({ title: `Nudged ${data.repName}`, description: `Recorded on ${data.number}.`, tone: "info" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card group px-3 py-2.5 transition-colors hover:border-border-strong">
      <div className="flex items-start justify-between gap-3">
        <Link href={href} className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="truncate text-[14px] font-medium">{title}</span>
            <span className="num text-[12px] text-faint">{number}</span>
          </div>
          <p className="mt-1 text-[13px]">{headline}</p>
        </Link>
        <div className="shrink-0 text-right">{right}</div>
      </div>
      {/* Detail and the escalation share a line, so the card stays three rows tall. */}
      <div className="mt-1.5 flex items-center justify-between gap-3">
        <p className="min-w-0 truncate text-[12px] text-muted" title={detail}>
          {detail}
        </p>
        {canNudge ? (
          <button
            type="button"
            disabled={busy}
            onClick={nudge}
            className="shrink-0 text-[12px] text-muted underline-offset-2 transition-colors hover:text-text hover:underline disabled:opacity-50"
          >
            {busy ? "Nudging…" : "Nudge rep"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
