import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { requireSessionUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { DiscountMatrix } from "@/components/backend/DiscountMatrix";

export const metadata: Metadata = { title: "Discount policy" };

const TIERS = ["BRONZE", "SILVER", "GOLD"] as const;

export default async function DiscountPolicyPage() {
  const user = await requireSessionUser();
  const [categories, policies] = await Promise.all([
    prisma.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.discountPolicy.findMany(),
  ]);

  const cells: Record<string, number> = {};
  for (const p of policies) cells[`${p.tier}:${p.categoryId}`] = p.ceilingPct;

  return (
    <DiscountMatrix
      tiers={[...TIERS]}
      categories={categories}
      cells={cells}
      canEdit={can(user, "config:discounts")}
    />
  );
}
