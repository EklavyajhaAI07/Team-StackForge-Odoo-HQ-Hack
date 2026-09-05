import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { requireSessionUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { ProductsConfig } from "@/components/backend/ProductsConfig";

export const metadata: Metadata = { title: "Products" };

export default async function ProductsPage() {
  const user = await requireSessionUser();
  const [products, categories] = await Promise.all([
    prisma.product.findMany({
      include: { category: { select: { id: true, name: true } }, variants: { orderBy: { extraPrice: "asc" } } },
      orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
    }),
    prisma.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <ProductsConfig
      products={products.map((p) => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        categoryId: p.categoryId,
        categoryName: p.category.name,
        kind: p.kind,
        unit: p.unit,
        cost: p.cost,
        listPrice: p.listPrice,
        taxPct: p.taxPct,
        isPromoted: p.isPromoted,
        attributeName: p.attributeName,
        variants: p.variants.map((v) => ({ id: v.id, value: v.value, extraPrice: v.extraPrice })),
      }))}
      categories={categories}
      canEdit={can(user, "config:all")}
    />
  );
}
