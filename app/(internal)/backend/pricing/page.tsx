import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { requireSessionUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { PriceListConfig } from "@/components/backend/PriceListConfig";

export const metadata: Metadata = { title: "Price lists" };

const TIERS = ["BRONZE", "SILVER", "GOLD"] as const;

export default async function PricingPage() {
  const user = await requireSessionUser();
  const [products, items] = await Promise.all([
    prisma.product.findMany({ select: { id: true, name: true, sku: true, listPrice: true }, orderBy: { name: "asc" } }),
    prisma.priceListItem.findMany(),
  ]);

  const overrides: Record<string, number> = {};
  for (const i of items) overrides[`${i.tier}:${i.productId}`] = i.price;

  return <PriceListConfig tiers={[...TIERS]} products={products} overrides={overrides} canEdit={can(user, "config:all")} />;
}
