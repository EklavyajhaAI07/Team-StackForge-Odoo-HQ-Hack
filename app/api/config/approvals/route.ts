import { z } from "zod";
import { prisma } from "@/lib/db";
import { authorize, handle, json, parseBody, requireUser } from "@/lib/api";
import { logAudit } from "@/lib/audit";

const schema = z.object({
  managerBlendedMaxPts: z.number().min(0).max(100),
  financeLineOveragePts: z.number().min(0).max(100),
  financeAmountThreshold: z.number().int().min(0),
  stalledDays: z.number().int().min(1).max(365),
  anomalySigma: z.number().min(0.1).max(10),
});

/** PUT /api/config/approvals — the thresholds routing reads. Never hardcoded anywhere else. */
export async function PUT(req: Request) {
  return handle(async () => {
    const user = await requireUser();
    authorize(user, "config:all");
    const body = await parseBody(req, schema);

    const saved = await prisma.$transaction(async (tx) => {
      const before = await tx.approvalConfig.findUnique({ where: { id: 1 } });
      const row = await tx.approvalConfig.upsert({ where: { id: 1 }, create: { id: 1, ...body }, update: body });
      const changes: string[] = [];
      if (before) {
        if (before.managerBlendedMaxPts !== row.managerBlendedMaxPts) changes.push(`manager ceiling ${before.managerBlendedMaxPts} → ${row.managerBlendedMaxPts} pts`);
        if (before.financeLineOveragePts !== row.financeLineOveragePts) changes.push(`finance line trigger ${before.financeLineOveragePts} → ${row.financeLineOveragePts} pts`);
        if (before.financeAmountThreshold !== row.financeAmountThreshold) changes.push(`finance amount ${before.financeAmountThreshold} → ${row.financeAmountThreshold} paise`);
        if (before.stalledDays !== row.stalledDays) changes.push(`stalled after ${before.stalledDays} → ${row.stalledDays} days`);
        if (before.anomalySigma !== row.anomalySigma) changes.push(`anomaly ${before.anomalySigma}σ → ${row.anomalySigma}σ`);
      }
      if (changes.length) {
        await logAudit(tx, {
          entityType: "Config",
          entityId: "approval-config",
          actor: { type: "USER", id: user.id },
          action: "config-updated",
          meta: { message: changes.join(", ") },
        });
      }
      return row;
    });

    return json({ ok: true, config: saved });
  });
}
