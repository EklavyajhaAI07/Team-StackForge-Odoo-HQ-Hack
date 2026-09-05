import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { requireSessionUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { PlansConfig } from "@/components/backend/PlansConfig";

export const metadata: Metadata = { title: "Plans" };

export default async function PlansPage() {
  const user = await requireSessionUser();
  const plans = await prisma.subscriptionPlan.findMany({
    include: { _count: { select: { lines: true } } },
    orderBy: [{ interval: "asc" }, { name: "asc" }],
  });

  return (
    <PlansConfig
      plans={plans.map((p) => ({ id: p.id, name: p.name, interval: p.interval, cancelRule: p.cancelRule, lineCount: p._count.lines }))}
      canEdit={can(user, "config:all")}
    />
  );
}
