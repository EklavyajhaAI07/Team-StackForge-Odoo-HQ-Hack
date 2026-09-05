import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSessionUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { assess, getConfig, getPolicyCeilings, getQuotationDetail } from "@/lib/services/quotation";
import { formatMoney, formatPct } from "@/lib/money";
import { lineNet } from "@/lib/quotes";
import { Card } from "@/components/ui/Card";
import { StepList } from "@/components/approval/StepList";
import { ApprovalActions } from "@/components/approval/ApprovalActions";

export const metadata: Metadata = { title: "Approval" };

export default async function ApprovalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireSessionUser();
  const q = await getQuotationDetail(prisma, id);
  if (!q) notFound();
  const [ceilings, config] = await Promise.all([getPolicyCeilings(prisma, q.customer.tier), getConfig(prisma)]);
  const { risk, totals, decision } = assess(q, ceilings, config);

  const pending = q.approvals.find((a) => a.status === "PENDING");
  const roleOk = pending ? can(user, pending.role === "FINANCE" ? "approval:finance" : "approval:manager") : false;
  const isOwner = q.repId === user.id;
  const canAct = !!pending && roleOk && !isOwner && (q.status === "PENDING_MANAGER" || q.status === "PENDING_FINANCE");

  return (
    <div className="grid grid-cols-12 gap-5">
      <div className="col-span-12 flex flex-col gap-5 xl:col-span-7">
        <Card>
          <div className="px-5 pt-4 pb-2">
            <h3 className="text-[15px] font-semibold">Per-line policy check</h3>
            <p className="text-[12px] text-muted">
              Given discount vs the {q.customer.tier.toLowerCase()}-tier ceiling for each category. Overage is in percentage points.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Line</th>
                  <th>Category</th>
                  <th className="num">Qty</th>
                  <th className="num">Given</th>
                  <th className="num">Ceiling</th>
                  <th className="num">Overage</th>
                  <th className="num">Net</th>
                </tr>
              </thead>
              <tbody>
                {q.lines.map((l) => {
                  const p = risk.perLine.find((x) => x.lineId === l.id)!;
                  return (
                    <tr key={l.id}>
                      <td className="font-medium">{l.product.name}</td>
                      <td className="text-muted">{l.product.category.name}</td>
                      <td className="num">{l.qty}</td>
                      <td className={`num ${p.overage > 0 ? "text-danger" : ""}`}>{formatPct(l.discountPct)}</td>
                      <td className="num text-muted">{formatPct(p.ceiling)}</td>
                      <td className={`num ${p.overage > 0 ? "text-danger" : "text-money"}`}>{p.overage > 0 ? `+${p.overage.toFixed(1)}` : "0.0"}</td>
                      <td className="num">{formatMoney(lineNet(l))}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={5}>Blended (revenue-weighted)</td>
                  <td className={`num ${risk.blended > 0 ? "text-danger" : "text-money"}`}>{risk.blended.toFixed(1)} pts</td>
                  <td className="num">{formatMoney(totals.net)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>

        <div className="grid grid-cols-3 gap-3">
          <Stat label="Blended risk" value={`${risk.blended.toFixed(1)} pts`} tone={risk.blended > config.managerBlendedMaxPts ? "danger" : risk.blended > 0 ? "warn" : "money"} />
          <Stat label="Worst line" value={`${risk.maxLineOverage.toFixed(1)} pts`} tone={risk.maxLineOverage > config.financeLineOveragePts ? "danger" : risk.maxLineOverage > 0 ? "warn" : "money"} />
          <Stat label="Margin" value={formatPct(risk.marginPct)} tone={risk.marginPct < 15 ? "warn" : "money"} />
        </div>
        <p className="text-[12px] text-muted">
          Thresholds: manager alone up to <span className="num">{config.managerBlendedMaxPts}</span> blended pts, finance joins above{" "}
          <span className="num">{config.financeLineOveragePts}</span> pts on any line or from <span className="num">{formatMoney(config.financeAmountThreshold, { whole: true })}</span> order value.
        </p>
      </div>

      <div className="col-span-12 flex flex-col gap-5 xl:col-span-5">
        <StepList approvals={q.approvals} status={q.status} decision={decision} />
        {canAct && pending ? (
          <ApprovalActions quotationId={q.id} step={pending.step} role={pending.role} />
        ) : pending && isOwner ? (
          <Card className="p-4 text-[13px] text-muted">You submitted this quotation, so the decision has to come from someone else.</Card>
        ) : pending && !roleOk ? (
          <Card className="p-4 text-[13px] text-muted">
            This step needs {pending.role === "FINANCE" ? "finance" : "a sales manager"}. Sign in as {pending.role === "FINANCE" ? "Vikram" : "Meera"} to act on it.
          </Card>
        ) : null}
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: "money" | "warn" | "danger" }) {
  const cls = tone === "money" ? "text-money" : tone === "warn" ? "text-warn" : "text-danger";
  return (
    <div className="card px-4 py-3">
      <p className="text-[12px] text-muted">{label}</p>
      <p className={`display num mt-0.5 text-[24px] font-semibold ${cls}`}>{value}</p>
    </div>
  );
}
