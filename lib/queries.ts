// Server-side read helpers shared by pages (server components only).
import type { Role } from "@prisma/client";
import { prisma } from "./db";
import { can } from "./rbac";

export const quotationListInclude = {
  customer: true,
  currency: true,
  rep: { select: { id: true, name: true } },
  lines: { include: { product: { select: { taxPct: true } } } },
} as const;

/**
 * A rep sees the quotations they own, so a new account opens on a clean desk rather than
 * somebody else's pipeline. Managers, finance and admin see the whole team, because
 * approving and fulfilling other people's work is precisely their job.
 */
export async function listQuotations(viewer?: { id: string; role: Role }) {
  const teamWide = !viewer || can(viewer, "quotations:all");
  return prisma.quotation.findMany({
    where: teamWide ? undefined : { repId: viewer.id },
    include: quotationListInclude,
    orderBy: { lastActivityAt: "desc" },
  });
}

export async function listCustomers() {
  return prisma.customer.findMany({
    orderBy: { company: "asc" },
    select: { id: true, company: true, name: true, tier: true, city: true },
  });
}

export async function getApprovalConfig() {
  return (
    (await prisma.approvalConfig.findUnique({ where: { id: 1 } })) ??
    (await prisma.approvalConfig.create({ data: { id: 1 } }))
  );
}
