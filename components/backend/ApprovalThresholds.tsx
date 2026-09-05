"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { formatMoney } from "@/lib/money";
import { SaveBar } from "./SaveBar";

type Config = {
  managerBlendedMaxPts: number;
  financeLineOveragePts: number;
  financeAmountThreshold: number;
  stalledDays: number;
  anomalySigma: number;
};

/** The numbers routing.ts and anomaly.ts read. Nothing in the engines hardcodes them. */
export function ApprovalThresholds({ config, canEdit }: { config: Config; canEdit: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const [draft, setDraft] = useState({
    managerBlendedMaxPts: String(config.managerBlendedMaxPts),
    financeLineOveragePts: String(config.financeLineOveragePts),
    financeAmountThresholdRupees: String(Math.round(config.financeAmountThreshold / 100)),
    stalledDays: String(config.stalledDays),
    anomalySigma: String(config.anomalySigma),
  });
  const [busy, setBusy] = useState(false);

  const parsed = {
    managerBlendedMaxPts: Number(draft.managerBlendedMaxPts),
    financeLineOveragePts: Number(draft.financeLineOveragePts),
    financeAmountThreshold: Math.round(Number(draft.financeAmountThresholdRupees) * 100),
    stalledDays: Math.round(Number(draft.stalledDays)),
    anomalySigma: Number(draft.anomalySigma),
  };
  const invalid =
    Object.values(parsed).some((v) => Number.isNaN(v)) || parsed.stalledDays < 1 || parsed.anomalySigma <= 0 || parsed.managerBlendedMaxPts < 0;
  const dirty =
    parsed.managerBlendedMaxPts !== config.managerBlendedMaxPts ||
    parsed.financeLineOveragePts !== config.financeLineOveragePts ||
    parsed.financeAmountThreshold !== config.financeAmountThreshold ||
    parsed.stalledDays !== config.stalledDays ||
    parsed.anomalySigma !== config.anomalySigma;

  async function save() {
    setBusy(true);
    try {
      const res = await fetch("/api/config/approvals", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: data.error ?? "Could not save the thresholds", tone: "danger" });
        return;
      }
      toast({ title: "Thresholds saved", description: "Routing uses them from the next submission.", tone: "money" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
      <Card>
        <SaveBar
          title="Approval thresholds"
          description="Where a quotation stops needing a manager and starts needing finance too."
          dirty={dirty}
          busy={busy}
          disabled={invalid || !canEdit}
          onSave={save}
        />
        <div className="grid gap-4 px-5 pb-5 md:grid-cols-2">
          <Field label="Manager handles up to" hint="Blended risk in percentage points">
            <Input numeric type="number" min={0} step={0.5} disabled={!canEdit} value={draft.managerBlendedMaxPts} onChange={(e) => setDraft((d) => ({ ...d, managerBlendedMaxPts: e.target.value }))} />
          </Field>
          <Field label="Finance joins above" hint="Overage on any single line, in points">
            <Input numeric type="number" min={0} step={0.5} disabled={!canEdit} value={draft.financeLineOveragePts} onChange={(e) => setDraft((d) => ({ ...d, financeLineOveragePts: e.target.value }))} />
          </Field>
          <Field label="Finance joins from" hint={`Order value in rupees — currently ${formatMoney(config.financeAmountThreshold, { whole: true })}`}>
            <Input numeric type="number" min={0} step={1000} disabled={!canEdit} value={draft.financeAmountThresholdRupees} onChange={(e) => setDraft((d) => ({ ...d, financeAmountThresholdRupees: e.target.value }))} />
          </Field>
          <Field label="Stalled after" hint="Days without activity before the dashboard flags it">
            <Input numeric type="number" min={1} step={1} disabled={!canEdit} value={draft.stalledDays} onChange={(e) => setDraft((d) => ({ ...d, stalledDays: e.target.value }))} />
          </Field>
          <Field label="Anomaly sensitivity" hint="Standard deviations above the rep's own average">
            <Input numeric type="number" min={0.1} step={0.1} disabled={!canEdit} value={draft.anomalySigma} onChange={(e) => setDraft((d) => ({ ...d, anomalySigma: e.target.value }))} />
          </Field>
        </div>
      </Card>

      <Card className="h-fit">
        <div className="px-5 pt-4 pb-2">
          <h2>How a quotation routes</h2>
        </div>
        <ol className="flex flex-col gap-3 px-5 pb-5 text-[14px]">
          <li>
            <span className="font-medium text-money">No approval</span>
            <p className="text-muted">Every line sits within its ceiling.</p>
          </li>
          <li>
            <span className="font-medium text-warn">Manager only</span>
            <p className="text-muted">
              Blended risk at or below <span className="num">{parsed.managerBlendedMaxPts || 0}</span> pts, no line more than{" "}
              <span className="num">{parsed.financeLineOveragePts || 0}</span> pts over, and the order below{" "}
              <span className="num">{formatMoney(parsed.financeAmountThreshold || 0, { whole: true })}</span>.
            </p>
          </li>
          <li>
            <span className="font-medium text-danger">Manager, then finance</span>
            <p className="text-muted">Anything past those limits.</p>
          </li>
        </ol>
      </Card>
    </div>
  );
}
