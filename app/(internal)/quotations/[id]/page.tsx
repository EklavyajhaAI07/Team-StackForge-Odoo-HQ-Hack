import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSessionUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { suggestUpsells } from "@/lib/engine/upsell";
import { activePortalUrl } from "@/lib/portal-url";
import { EDITABLE_STATUSES, getConfig, getPolicyCeilings, getQuotationDetail, getTierPrices, openCounters } from "@/lib/services/quotation";
import { Builder } from "@/components/builder/Builder";
import type { BuilderLine, CatalogItem } from "@/components/builder/types";
import { CounterInbox, type CounterView } from "@/components/quotations/CounterInbox";
import { LiveQuotation } from "@/components/quotations/LiveQuotation";

export const metadata: Metadata = { title: "Builder" };

export default async function BuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireSessionUser();
  const q = await getQuotationDetail(prisma, id);
  if (!q) notFound();

  const [ceilings, tierPrices, config, products, categories, plans, history] = await Promise.all([
    getPolicyCeilings(prisma, q.customer.tier),
    getTierPrices(prisma, q.customer.tier),
    getConfig(prisma),
    prisma.product.findMany({ include: { category: true, variants: { orderBy: { extraPrice: "asc" } } }, orderBy: [{ category: { name: "asc" } }, { name: "asc" }] }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    prisma.subscriptionPlan.findMany({ orderBy: [{ interval: "asc" }, { name: "asc" }] }),
    prisma.historicalOrder.findMany({ select: { productIds: true } }),
  ]);

  const catalog: CatalogItem[] = products.map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    categoryId: p.categoryId,
    categoryName: p.category.name,
    kind: p.kind,
    unit: p.unit,
    listPrice: p.listPrice,
    tierPrice: tierPrices.get(p.id) ?? null,
    cost: p.cost,
    taxPct: p.taxPct,
    isPromoted: p.isPromoted,
    attributeName: p.attributeName,
    variants: p.variants.map((v) => ({ id: v.id, value: v.value, extraPrice: v.extraPrice })),
    description: p.description,
  }));

  const lines: BuilderLine[] = q.lines.map((l) => ({
    id: l.id,
    productId: l.productId,
    name: l.product.name,
    sku: l.product.sku,
    categoryName: l.product.category.name,
    unit: l.product.unit,
    isRecurring: l.isRecurring,
    variantId: l.variantId,
    variantValue: l.variant?.value ?? null,
    planId: l.planId,
    planName: l.plan?.name ?? null,
    qty: l.qty,
    unitPrice: l.unitPrice,
    discountPct: l.discountPct,
    cost: l.product.cost,
    taxPct: l.product.taxPct,
    ceilingPct: ceilings.get(l.product.categoryId) ?? 0,
    variants: l.product.variants.map((v) => ({ id: v.id, value: v.value, extraPrice: v.extraPrice })),
  }));

  const cartIds = q.lines.map((l) => l.productId);
  const names = Object.fromEntries(products.map((p) => [p.id, p.name]));
  const upsell = cartIds.length
    ? suggestUpsells({
        cartProductIds: cartIds,
        history,
        products: products.map((p) => ({ id: p.id, name: p.name, isPromoted: p.isPromoted, cost: p.cost, netUnit: tierPrices.get(p.id) ?? p.listPrice })),
        productNames: names,
      })
    : [];

  const owns = can(user, "quotation:edit", { repId: q.repId });
  const permissions = {
    canEdit: owns && EDITABLE_STATUSES.includes(q.status),
    canSubmit: can(user, "quotation:send", { repId: q.repId }),
    canRevise: owns,
  };

  const counters: CounterView[] = openCounters(q.messages).flatMap((m) => {
    const line = q.lines.find((l) => l.id === m.lineId);
    if (!line || m.counterDiscountPct == null) return [];
    return [
      {
        id: m.id,
        lineId: m.lineId,
        lineName: line.product.name,
        body: m.body,
        counterDiscountPct: m.counterDiscountPct,
        currentDiscountPct: line.discountPct,
        ceilingPct: ceilings.get(line.product.categoryId) ?? 0,
        createdAt: m.createdAt.toISOString(),
        lineTotalAfter: Math.round(line.qty * line.unitPrice * (1 - m.counterDiscountPct / 100)),
      },
    ];
  });

  return (
    <>
      <LiveQuotation quotationId={q.id} />
      {counters.length > 0 ? (
        <div className="mb-5">
          <CounterInbox quotationId={q.id} counters={counters} canAnswer={owns} />
        </div>
      ) : null}
      <Builder
      quotation={{ id: q.id, number: q.number, status: q.status, repId: q.repId, customerCompany: q.customer.company, customerTier: q.customer.tier }}
      lines={lines}
      catalog={catalog}
      categories={categories.map((c) => ({ id: c.id, name: c.name }))}
      plans={plans.map((p) => ({ id: p.id, name: p.name, interval: p.interval, cancelRule: p.cancelRule }))}
      config={{ managerBlendedMaxPts: config.managerBlendedMaxPts, financeLineOveragePts: config.financeLineOveragePts, financeAmountThreshold: config.financeAmountThreshold }}
      ceilings={Object.fromEntries(ceilings)}
      upsell={upsell}
      permissions={permissions}
      portalUrl={activePortalUrl(q.portalTokens)}
      serverVersion={q.lastActivityAt.toISOString()}
      />
    </>
  );
}
