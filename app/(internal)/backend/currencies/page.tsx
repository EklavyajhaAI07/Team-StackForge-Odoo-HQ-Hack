import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { requireSessionUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { CurrencyConfig } from "@/components/backend/CurrencyConfig";

export const metadata: Metadata = { title: "Currencies" };

export default async function CurrenciesPage() {
  const user = await requireSessionUser();
  const [currencies, customers] = await Promise.all([
    // Base first, then the rest alphabetically — the unit belongs at the top of the table.
    prisma.currency.findMany({ orderBy: [{ isBase: "desc" }, { code: "asc" }] }),
    prisma.customer.findMany({
      orderBy: { company: "asc" },
      select: { id: true, company: true, tier: true, currencyCode: true, _count: { select: { quotations: true } } },
    }),
  ]);

  return (
    <CurrencyConfig
      currencies={currencies}
      customers={customers.map((c) => ({
        id: c.id,
        company: c.company,
        tier: c.tier,
        currencyCode: c.currencyCode,
        quotationCount: c._count.quotations,
      }))}
      canEdit={can(user, "config:all")}
    />
  );
}
