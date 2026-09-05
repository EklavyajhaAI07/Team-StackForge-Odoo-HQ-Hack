import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { requireSessionUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { WarehouseConfig } from "@/components/backend/WarehouseConfig";

export const metadata: Metadata = { title: "Warehouses & stock" };

export default async function WarehousesPage() {
  const user = await requireSessionUser();
  const [warehouses, products] = await Promise.all([
    prisma.warehouse.findMany({ include: { stock: true }, orderBy: { shippingCostWeight: "asc" } }),
    // Only stockable things belong on a stock grid, so subscriptions are left out.
    prisma.product.findMany({ where: { kind: "ONE_TIME" }, select: { id: true, name: true, sku: true, unit: true }, orderBy: { name: "asc" } }),
  ]);

  const stock: Record<string, number> = {};
  for (const w of warehouses) for (const s of w.stock) stock[`${w.id}:${s.productId}`] = s.qty;

  return (
    <WarehouseConfig
      warehouses={warehouses.map((w) => ({ id: w.id, name: w.name, city: w.city, shippingCostWeight: w.shippingCostWeight }))}
      products={products}
      stock={stock}
      canEdit={can(user, "config:all")}
    />
  );
}
