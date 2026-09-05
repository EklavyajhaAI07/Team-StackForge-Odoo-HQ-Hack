import type { Metadata } from "next";
import { requireSessionUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { getConfig } from "@/lib/services/quotation";
import { prisma } from "@/lib/db";
import { ApprovalThresholds } from "@/components/backend/ApprovalThresholds";

export const metadata: Metadata = { title: "Approval thresholds" };

export default async function ApprovalsPage() {
  const user = await requireSessionUser();
  const config = await getConfig(prisma);
  return (
    <ApprovalThresholds
      config={{
        managerBlendedMaxPts: config.managerBlendedMaxPts,
        financeLineOveragePts: config.financeLineOveragePts,
        financeAmountThreshold: config.financeAmountThreshold,
        stalledDays: config.stalledDays,
        anomalySigma: config.anomalySigma,
      }}
      canEdit={can(user, "config:all")}
    />
  );
}
