"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Pill } from "@/components/ui/Pill";
import { useToast } from "@/components/ui/Toast";
import { IconPlus } from "@/components/ui/icons";

type Plan = { id: string; name: string; interval: string; cancelRule: string; lineCount: number };

const INTERVAL_LABEL: Record<string, string> = { MONTHLY: "Monthly", QUARTERLY: "Quarterly", YEARLY: "Yearly" };

export function PlansConfig({ plans, canEdit }: { plans: Plan[]; canEdit: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState({ name: "", interval: "MONTHLY", cancelRule: "PRORATED_CREDIT" });

  async function save(url: string, method: string, body: unknown, success: string) {
    setBusy(true);
    try {
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: data.error ?? "That did not save", tone: "danger" });
        return false;
      }
      toast({ title: success, tone: "money" });
      router.refresh();
      return true;
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-4 px-5 pt-4 pb-2">
        <div>
          <h2>Subscription plans</h2>
          <p className="text-[13px] text-muted">
            The interval sets the billing cycle. The cancellation rule decides whether an early cancellation earns a credit note.
          </p>
        </div>
        {canEdit ? (
          <Button variant="secondary" icon={<IconPlus size={14} />} onClick={() => setAdding(true)}>
            Add plan
          </Button>
        ) : null}
      </div>

      <div className="overflow-x-auto px-5 pb-5">
        <table className="table">
          <thead>
            <tr>
              <th>Plan</th>
              <th>Billing interval</th>
              <th>On cancellation</th>
              <th className="num">Lines using it</th>
            </tr>
          </thead>
          <tbody>
            {plans.map((p) => (
              <tr key={p.id}>
                <td className="font-medium">{p.name}</td>
                <td>
                  {canEdit ? (
                    <Select
                      dense
                      className="w-[140px]"
                      value={p.interval}
                      onChange={(e) => save("/api/config/plans", "PATCH", { id: p.id, interval: e.target.value }, `${p.name} now bills ${INTERVAL_LABEL[e.target.value].toLowerCase()}`)}
                    >
                      {Object.entries(INTERVAL_LABEL).map(([v, l]) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </Select>
                  ) : (
                    INTERVAL_LABEL[p.interval]
                  )}
                </td>
                <td>
                  {canEdit ? (
                    <Select
                      dense
                      className="w-[190px]"
                      value={p.cancelRule}
                      onChange={(e) => save("/api/config/plans", "PATCH", { id: p.id, cancelRule: e.target.value }, `${p.name} cancellation rule updated`)}
                    >
                      <option value="PRORATED_CREDIT">Credit the unused days</option>
                      <option value="NO_REFUND">No refund</option>
                    </Select>
                  ) : (
                    <Pill tone={p.cancelRule === "NO_REFUND" ? "warn" : "money"}>
                      {p.cancelRule === "NO_REFUND" ? "No refund" : "Credit the unused days"}
                    </Pill>
                  )}
                </td>
                <td className="num text-muted">{p.lineCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        open={adding}
        onClose={() => setAdding(false)}
        title="Add a plan"
        footer={
          <>
            <Button variant="ghost" onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={busy}
              disabled={draft.name.trim().length < 2}
              onClick={async () => {
                const ok = await save("/api/config/plans", "POST", { ...draft, name: draft.name.trim() }, `${draft.name.trim()} added`);
                if (ok) {
                  setAdding(false);
                  setDraft({ name: "", interval: "MONTHLY", cancelRule: "PRORATED_CREDIT" });
                }
              }}
            >
              Add plan
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <Field label="Name">
            <Input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} placeholder="Half-yearly" />
          </Field>
          <Field label="Billing interval">
            <Select value={draft.interval} onChange={(e) => setDraft((d) => ({ ...d, interval: e.target.value }))}>
              {Object.entries(INTERVAL_LABEL).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="On cancellation">
            <Select value={draft.cancelRule} onChange={(e) => setDraft((d) => ({ ...d, cancelRule: e.target.value }))}>
              <option value="PRORATED_CREDIT">Credit the unused days</option>
              <option value="NO_REFUND">No refund</option>
            </Select>
          </Field>
        </div>
      </Modal>
    </Card>
  );
}
