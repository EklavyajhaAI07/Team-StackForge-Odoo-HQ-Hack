"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Textarea } from "@/components/ui/Input";
import { Pill } from "@/components/ui/Pill";
import { useToast } from "@/components/ui/Toast";
import { relativeTime } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import type { DisplayCurrency } from "@/lib/money";

export type CounterView = {
  id: string;
  lineId: string | null;
  lineName: string;
  body: string;
  counterDiscountPct: number;
  currentDiscountPct: number;
  ceilingPct: number;
  createdAt: string;
  /** Order value of that line if the counter were accepted. */
  lineTotalAfter: number;
};

/** Requested changes waiting on the rep. Accepting re-runs routing, which may re-open approval. */
export function CounterInbox({
  quotationId,
  counters,
  canAnswer,
  currency,
}: {
  quotationId: string;
  counters: CounterView[];
  canAnswer: boolean;
  currency: DisplayCurrency;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [replyFor, setReplyFor] = useState<string | null>(null);
  const [reply, setReply] = useState("");

  if (counters.length === 0) return null;

  async function answer(messageId: string, decision: "ACCEPT" | "DECLINE") {
    setBusy(messageId + decision);
    try {
      const res = await fetch(`/api/quotations/${quotationId}/counters`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId, decision, reply: reply.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: data.error ?? "That did not work", tone: "danger" });
        return;
      }
      setReply("");
      setReplyFor(null);
      if (decision === "DECLINE") {
        toast({ title: "Request declined", description: "The customer can see your reply.", tone: "info" });
      } else if (data.rerouted && data.rerouted !== "AUTO_APPROVED") {
        toast({
          title: "Discount applied — back to approval",
          description: data.rerouted === "MANAGER_FINANCE" ? "Now needs manager, then finance." : "Now needs manager sign-off.",
          tone: "warn",
          durationMs: 6000,
        });
      } else {
        toast({ title: "Discount applied — still within policy", tone: "money" });
      }
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="border-primary/40">
      <div className="flex items-center justify-between px-5 pt-4 pb-2">
        <div>
          <h3>Requested changes</h3>
          <p className="text-[13px] text-muted">Accepting re-runs the discount policy, so an over-ceiling price returns to approval on its own.</p>
        </div>
        <Pill tone="primary">{counters.length}</Pill>
      </div>
      <ul className="flex flex-col gap-3 px-5 pb-5">
        {counters.map((c) => {
          const over = c.counterDiscountPct - c.ceilingPct;
          return (
            <li key={c.id} className="rounded-[8px] border border-border bg-bg/40 px-3 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[14px] font-medium">{c.lineName}</p>
                  <p className="mt-0.5 text-[13px] text-muted">{c.body}</p>
                </div>
                <span className="shrink-0 text-right">
                  <span className="num block text-[16px] font-semibold">{c.counterDiscountPct}%</span>
                  <span className="num block text-[12px] text-muted">now {c.currentDiscountPct}%</span>
                </span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px]">
                <span className="text-muted">{relativeTime(c.createdAt)}</span>
                {over > 0 ? (
                  <Pill tone="danger">
                    <span className="num">{over.toFixed(1)}</span> pts over the {c.ceilingPct}% ceiling
                  </Pill>
                ) : (
                  <Pill tone="money">Within the {c.ceilingPct}% ceiling</Pill>
                )}
                <span className="num text-muted">line becomes {formatMoney(c.lineTotalAfter, { whole: true, currency })}</span>
              </div>

              {canAnswer ? (
                <>
                  {replyFor === c.id ? (
                    <Textarea
                      className="mt-2"
                      rows={2}
                      autoFocus
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                      placeholder="Optional note back to the customer"
                    />
                  ) : null}
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button size="sm" variant="primary" loading={busy === c.id + "ACCEPT"} onClick={() => answer(c.id, "ACCEPT")}>
                      Accept {c.counterDiscountPct}%
                    </Button>
                    <Button size="sm" variant="secondary" loading={busy === c.id + "DECLINE"} onClick={() => answer(c.id, "DECLINE")}>
                      Decline
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setReplyFor(replyFor === c.id ? null : c.id)}>
                      {replyFor === c.id ? "Hide note" : "Add a note"}
                    </Button>
                  </div>
                </>
              ) : (
                <p className="mt-2 text-[13px] text-muted">Only the owning rep can answer this.</p>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
