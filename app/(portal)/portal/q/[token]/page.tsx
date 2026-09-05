import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getPortalSession } from "@/lib/portal-auth";
import { formatDate, formatDateTime, isPast } from "@/lib/format";
import { formatMoney, formatPct } from "@/lib/money";
import { lineNet, quotationTotals } from "@/lib/quotes";
import { StatusPill } from "@/components/ui/Pill";

export default async function PortalQuotationPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ s?: string }>;
}) {
  const { token } = await params;
  const { s } = await searchParams;

  const row = await prisma.portalToken.findUnique({
    where: { token },
    include: {
      customer: true,
      quotation: {
        include: {
          rep: { select: { name: true, email: true } },
          lines: { include: { product: { select: { name: true, unit: true, taxPct: true } }, variant: true, plan: true } },
        },
      },
    },
  });

  if (!row) redirect("/portal/invalid?reason=missing");
  if (isPast(row.expiresAt)) redirect("/portal/invalid?reason=expired");

  // Establish the portal-realm cookie for exactly this quotation, once.
  const session = await getPortalSession();
  if (!session || session.quotationId !== row.quotationId) {
    if (s === "1") {
      return (
        <main className="mx-auto max-w-[720px] px-6 py-16">
          <h1 className="text-[24px]">We could not open your quotation</h1>
          <p className="mt-3 text-muted">Your browser did not keep the sign-in cookie. Enable cookies for this site and open the link again.</p>
        </main>
      );
    }
    redirect(`/api/portal/session/${token}`);
  }

  const q = row.quotation;
  const totals = quotationTotals(q.lines);

  return (
    <main className="mx-auto w-full max-w-[720px] px-6 pb-32 pt-12">
      <header className="flex items-start justify-between gap-6">
        <div>
          <p className="text-[13px] text-muted">Quotation for {row.customer.company}</p>
          <h1 className="mt-1 text-[30px]">
            <span className="num font-semibold">{q.number}</span>
          </h1>
          <p className="mt-2 text-[13px] text-muted">
            Prepared by {q.rep.name} · Valid until {formatDate(row.expiresAt)}
          </p>
        </div>
        <StatusPill status={q.status} />
      </header>

      <section className="card mt-8 overflow-hidden">
        <table className="table">
          <thead>
            <tr>
              <th>Item</th>
              <th className="num">Qty</th>
              <th className="num">Unit price</th>
              <th className="num">Discount</th>
              <th className="num">Amount</th>
            </tr>
          </thead>
          <tbody>
            {q.lines.map((l) => (
              <tr key={l.id}>
                <td>
                  <div className="font-medium">{l.product.name}</div>
                  <div className="text-[12px] text-muted">
                    {l.variant ? `${l.variant.value} · ` : ""}
                    {l.plan ? `Billed ${l.plan.name.toLowerCase()} · ` : ""}
                    per {l.product.unit}
                  </div>
                </td>
                <td className="num">{l.qty}</td>
                <td className="num">{formatMoney(l.unitPrice)}</td>
                <td className="num">{l.discountPct > 0 ? formatPct(l.discountPct) : "—"}</td>
                <td className="num">{formatMoney(lineNet(l))}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4} className="text-right text-muted">
                Subtotal
              </td>
              <td className="num">{formatMoney(totals.net)}</td>
            </tr>
            <tr>
              <td colSpan={4} className="text-right text-muted">
                Tax
              </td>
              <td className="num">{formatMoney(totals.tax)}</td>
            </tr>
            <tr>
              <td colSpan={4} className="text-right">
                Total
              </td>
              <td className="num text-[15px]">{formatMoney(totals.total)}</td>
            </tr>
          </tfoot>
        </table>
      </section>

      <p className="mt-6 text-[12px] text-muted">
        Issued {formatDateTime(q.createdAt)}. Recurring items are billed per cycle; one-time items are invoiced on confirmation.
      </p>
    </main>
  );
}
