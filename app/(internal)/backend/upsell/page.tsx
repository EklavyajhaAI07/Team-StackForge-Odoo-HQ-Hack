import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { requireSessionUser } from "@/lib/auth";
import { learnedPairs, MIN_UPSELL_MARGIN_PCT } from "@/lib/engine/upsell";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pill } from "@/components/ui/Pill";

export const metadata: Metadata = { title: "Upsell pairs" };

/** Read-only by design (§9): the pairs are learned from order history, not authored. */
export default async function UpsellPage() {
  await requireSessionUser();
  const [history, products] = await Promise.all([
    prisma.historicalOrder.findMany({ select: { productIds: true } }),
    prisma.product.findMany({ select: { id: true, name: true, isPromoted: true } }),
  ]);

  const names = Object.fromEntries(products.map((p) => [p.id, p.name]));
  const promoted = new Set(products.filter((p) => p.isPromoted).map((p) => p.id));
  const pairs = learnedPairs(history, names, 25);

  return (
    <Card>
      <div className="px-5 pt-4 pb-2">
        <h2 className="text-[15px] font-semibold">Learned from order history</h2>
        <p className="text-[12px] text-muted">
          How often two products were bought together across {history.length} past orders. The builder ranks suggestions by this count,
          weights promoted items 1.5×, and drops anything below {MIN_UPSELL_MARGIN_PCT}% margin. There is nothing to author here.
        </p>
      </div>
      <div className="max-h-[560px] overflow-auto px-5 pb-5">
        {pairs.length === 0 ? (
          <EmptyState compact title="No pairs learned yet" description="Once orders accumulate, co-purchase patterns appear here." />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th className="num">#</th>
                <th>Product</th>
                <th>Bought with</th>
                <th className="num">Times together</th>
              </tr>
            </thead>
            <tbody>
              {pairs.map((p, i) => (
                <tr key={`${p.a}-${p.b}`}>
                  <td className="num text-muted">{i + 1}</td>
                  <td>
                    <span className="font-medium">{p.aName}</span>
                    {promoted.has(p.a) ? <Pill tone="primary" className="ml-2">Promoted</Pill> : null}
                  </td>
                  <td>
                    <span className="font-medium">{p.bName}</span>
                    {promoted.has(p.b) ? <Pill tone="primary" className="ml-2">Promoted</Pill> : null}
                  </td>
                  <td className="num">{p.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Card>
  );
}
