import { Card } from "@/components/ui/Card";
import { StatusPill, APPROVAL_STATUS } from "@/components/ui/Pill";
import { stepLabel, type RoutingDecision } from "@/lib/engine/routing";
import { formatDateTime } from "@/lib/format";

type ApprovalRow = {
  id: string;
  step: number;
  role: string;
  status: string;
  reason: string | null;
  actedAt: Date | null;
  approver: { name: string } | null;
};

export function StepList({ approvals, status, decision }: { approvals: ApprovalRow[]; status: string; decision: RoutingDecision }) {
  return (
    <Card>
      <div className="px-5 pt-4 pb-2">
        <h3>Approval chain</h3>
        <p className="text-[13px] text-muted">Steps are decided by routing, never picked by the rep.</p>
      </div>
      <div className="px-5 pb-5">
        {approvals.length === 0 ? (
          <div className="rounded-[8px] border border-dashed border-border-strong px-4 py-3 text-[14px]">
            {status === "DRAFT" ? (
              <>
                <p className="font-medium">Not submitted yet</p>
                <p className="mt-1 text-muted">
                  Current terms would route to{" "}
                  {decision.kind === "AUTO_APPROVED" ? "auto-approval — within policy" : decision.steps.map((s) => stepLabel(s).toLowerCase()).join(", then ")}.
                </p>
              </>
            ) : (
              <>
                <p className="font-medium text-money">Auto-approved — within policy</p>
                <p className="mt-1 text-muted">No line exceeded its ceiling, so no human step was required.</p>
              </>
            )}
          </div>
        ) : (
          <ol className="flex flex-col gap-2">
            {approvals.map((a) => (
              <li key={a.id} className="flex items-start gap-3 rounded-[8px] border border-border px-3 py-2.5">
                <span className="num mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-raised text-[13px]">{a.step}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[14px] font-medium">{stepLabel(a.role as "SALES_MANAGER" | "FINANCE")}</p>
                    <StatusPill status={a.status} map={APPROVAL_STATUS} />
                  </div>
                  {a.approver ? (
                    <p className="mt-0.5 text-[13px] text-muted">
                      {a.approver.name} · {formatDateTime(a.actedAt)}
                    </p>
                  ) : (
                    <p className="mt-0.5 text-[13px] text-muted">Waiting</p>
                  )}
                  {a.reason ? <p className="mt-1 text-[13px]">“{a.reason}”</p> : null}
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </Card>
  );
}
