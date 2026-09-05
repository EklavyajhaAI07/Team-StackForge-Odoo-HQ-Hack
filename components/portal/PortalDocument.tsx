"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { Pill, StatusPill } from "@/components/ui/Pill";
import { IconCheck, IconX } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { formatDate, formatDateTime } from "@/lib/format";
import { formatMoney, formatPct } from "@/lib/money";
import type { PortalView } from "@/lib/services/portal";

/** Customer-facing status wording. Internal step names never reach this screen. */
const CUSTOMER_STATUS: Record<string, { label: string; tone: "neutral" | "info" | "primary" | "money" | "warn" }> = {
  SENT: { label: "Awaiting your review", tone: "info" },
  UNDER_NEGOTIATION: { label: "Your change is with us", tone: "primary" },
  PENDING_MANAGER: { label: "With our approvals team", tone: "warn" },
  PENDING_FINANCE: { label: "With our approvals team", tone: "warn" },
  APPROVED: { label: "Ready for you", tone: "money" },
  CONFIRMED: { label: "Confirmed", tone: "money" },
};

export function PortalDocument({ quotation, validUntil }: { quotation: PortalView; validUntil: string }) {
  const router = useRouter();
  const [openLine, setOpenLine] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [counter, setCounter] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "info" | "warn" | "money" | "danger"; text: string } | null>(null);
  const [confirmed, setConfirmed] = useState(quotation.status === "CONFIRMED");
  const celebrated = useRef(false);

  // §3.4 motion #5 — exactly one confetti burst, only when the customer confirms here.
  useEffect(() => {
    if (!confirmed || celebrated.current) return;
    celebrated.current = true;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    void import("canvas-confetti").then(({ default: confetti }) => {
      confetti({ particleCount: 120, spread: 70, origin: { y: 0.7 }, colors: ["#3ECF8E", "#5563E8", "#F5B942"] });
    });
  }, [confirmed]);

  const status = CUSTOMER_STATUS[quotation.status] ?? { label: "In progress", tone: "neutral" as const };
  const awaitingUs = quotation.status === "PENDING_MANAGER" || quotation.status === "PENDING_FINANCE";
  const hasOpenCounter = quotation.lines.some((l) => l.counterPct != null);
  const locked = confirmed || quotation.status === "CONFIRMED";

  async function send(lineId: string) {
    const pct = counter.trim() === "" ? null : Number(counter);
    if (!comment.trim() && pct == null) {
      setNotice({ tone: "warn", text: "Add a note or a percentage before sending." });
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch("/api/portal/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lineId, body: comment.trim(), counterDiscountPct: pct }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNotice({ tone: "danger", text: data.error ?? "That did not send" });
        return;
      }
      setComment("");
      setCounter("");
      setOpenLine(null);
      setNotice({ tone: "money", text: pct != null ? "Sent — your account manager will come back to you." : "Comment sent." });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function confirmQuotation() {
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch("/api/portal/confirm", { method: "POST", headers: { "Content-Type": "application/json" } });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNotice({ tone: "warn", text: data.message ?? data.error ?? "We could not confirm that yet" });
        router.refresh();
        return;
      }
      setConfirmed(true);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (locked) {
    return (
      <main className="mx-auto w-full max-w-[720px] px-6 py-16">
        <div className="card px-6 py-8 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-money-soft text-money">
            <IconCheck size={22} />
          </span>
          <h1 className="mt-4 text-[24px]">Thank you — quotation confirmed</h1>
          <p className="mt-2 text-[14px] text-muted">
            <span className="num">{quotation.number}</span> is confirmed for {quotation.company}. Our team will be in touch about delivery and invoicing.
          </p>
          <p className="num mt-6 text-[24px] font-semibold">{formatMoney(quotation.totals.total)}</p>
          <p className="text-[12px] text-muted">including tax</p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-[720px] px-6 pb-32 pt-12">
      <header className="flex items-start justify-between gap-6">
        <div>
          <p className="text-[13px] text-muted">Quotation for {quotation.company}</p>
          <h1 className="num mt-1 text-[30px] font-semibold">{quotation.number}</h1>
          <p className="mt-2 text-[13px] text-muted">
            Prepared by {quotation.repName} · Valid until {formatDate(validUntil)}
          </p>
        </div>
        <Pill tone={status.tone} dot>
          {status.label}
        </Pill>
      </header>

      {awaitingUs ? (
        <p className="mt-6 rounded-[12px] border border-warn/40 bg-warn-soft px-4 py-3 text-[13px]">
          Your requested terms are with our approvals team. We will come back to you shortly.
        </p>
      ) : null}

      <section className="card mt-8 overflow-hidden">
        <table className="table">
          <thead>
            <tr>
              <th>Item</th>
              <th className="num">Qty</th>
              <th className="num">Unit price</th>
              <th className="num">Discount</th>
              <th className="num">Amount</th>
            </tr>
          </thead>
          <tbody>
            {quotation.lines.map((l) => (
              <tr key={l.id}>
                <td>
                  <div className="font-medium">{l.name}</div>
                  <div className="text-[12px] text-muted">
                    {l.variantValue ? `${l.variantValue} · ` : ""}
                    {l.planName ? `Billed ${l.planName.toLowerCase()} · ` : ""}
                    per {l.unit}
                  </div>
                  {l.counterPct != null ? (
                    <div className="mt-1">
                      <Pill tone="primary">
                        You asked for <span className="num">{l.counterPct}%</span>
                      </Pill>
                    </div>
                  ) : null}
                  {l.messages.length > 0 ? (
                    <ul className="mt-1.5 flex flex-col gap-1">
                      {l.messages.map((m) => (
                        <li key={m.id} className="text-[12px]">
                          <span className={cn("font-medium", m.authorType === "REP" ? "text-primary" : "text-muted")}>
                            {m.authorType === "REP" ? quotation.repName : "You"}
                          </span>
                          <span className="text-muted"> · {formatDateTime(m.createdAt)}</span>
                          <p className="text-muted">{m.body}</p>
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  {openLine === l.id ? (
                    <div className="mt-2 rounded-[8px] border border-border bg-raised px-3 py-3">
                      <label className="text-[12px] text-muted" htmlFor={`c-${l.id}`}>
                        Ask a question or propose a discount
                      </label>
                      <Textarea
                        id={`c-${l.id}`}
                        className="mt-1"
                        rows={2}
                        autoFocus
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder="e.g. Can you match the price we had last year?"
                      />
                      <div className="mt-2 flex items-end gap-2">
                        <label className="flex flex-col gap-1 text-[12px] text-muted">
                          Discount you would like
                          <div className="relative">
                            <Input
                              numeric
                              dense
                              type="number"
                              min={0}
                              max={100}
                              step={0.5}
                              className="w-24 pr-6"
                              value={counter}
                              onChange={(e) => setCounter(e.target.value)}
                              placeholder={String(l.discountPct)}
                            />
                            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-muted">%</span>
                          </div>
                        </label>
                        <Button size="sm" variant="primary" loading={busy} onClick={() => send(l.id)}>
                          Send request
                        </Button>
                        <Button size="sm" variant="ghost" icon={<IconX size={13} />} onClick={() => setOpenLine(null)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="mt-1.5 text-[12px] font-medium text-primary hover:underline"
                      onClick={() => {
                        setOpenLine(l.id);
                        setComment("");
                        setCounter("");
                      }}
                    >
                      Ask / propose change
                    </button>
                  )}
                </td>
                <td className="num align-top">{l.qty}</td>
                <td className="num align-top">{formatMoney(l.unitPrice)}</td>
                <td className="num align-top">{l.discountPct > 0 ? formatPct(l.discountPct) : "—"}</td>
                <td className="num align-top">{formatMoney(l.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4} className="text-right text-muted">
                Subtotal
              </td>
              <td className="num">{formatMoney(quotation.totals.net)}</td>
            </tr>
            <tr>
              <td colSpan={4} className="text-right text-muted">
                Tax
              </td>
              <td className="num">{formatMoney(quotation.totals.tax)}</td>
            </tr>
            <tr>
              <td colSpan={4} className="text-right">
                Total
              </td>
              <td className="num text-[15px]">{formatMoney(quotation.totals.total)}</td>
            </tr>
          </tfoot>
        </table>
      </section>

      {notice ? (
        <p
          className={cn(
            "mt-4 rounded-[8px] px-4 py-3 text-[13px]",
            notice.tone === "danger" && "bg-danger-soft text-danger",
            notice.tone === "warn" && "bg-warn-soft text-warn",
            notice.tone === "money" && "bg-money-soft text-money",
            notice.tone === "info" && "bg-info-soft text-info",
          )}
        >
          {notice.text}
        </p>
      ) : null}

      <div className="fixed inset-x-0 bottom-0 border-t border-border bg-surface/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[720px] items-center justify-between gap-4 px-6 py-3">
          <div className="min-w-0">
            <p className="text-[12px] text-muted">Total including tax</p>
            <p className="num text-[19px] font-semibold">{formatMoney(quotation.totals.total)}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                const first = quotation.lines[0];
                if (first) {
                  setOpenLine(first.id);
                  document.getElementById(`c-${first.id}`)?.scrollIntoView({ block: "center" });
                }
              }}
            >
              Propose changes
            </Button>
            <Button variant="money" size="lg" loading={busy} disabled={awaitingUs || hasOpenCounter} onClick={confirmQuotation}>
              Confirm quotation
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}

export { StatusPill };
