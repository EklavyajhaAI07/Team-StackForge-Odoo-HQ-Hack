// Server-side read helpers shared by pages (server components only).
import { prisma } from "./db";

export const quotationListInclude = {
  customer: true,
  rep: { select: { id: true, name: true } },
  lines: { include: { product: { select: { taxPct: true } } } },
} as const;

export async function listQuotations() {
  return prisma.quotation.findMany({
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
