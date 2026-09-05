import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getPortalSession } from "@/lib/portal-auth";
import { isPast } from "@/lib/format";
import { loadPortalQuotation, toPortalView } from "@/lib/services/portal";
import { PortalDocument } from "@/components/portal/PortalDocument";

export default async function PortalQuotationPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ s?: string }>;
}) {
  const { token } = await params;
  const { s } = await searchParams;

  const row = await prisma.portalToken.findUnique({ where: { token }, select: { id: true, quotationId: true, customerId: true, expiresAt: true } });
  if (!row) redirect("/portal/invalid?reason=missing");
  if (isPast(row.expiresAt)) redirect("/portal/invalid?reason=expired");

  // The magic link mints a portal-realm cookie scoped to exactly this quotation.
  const session = await getPortalSession();
  if (!session || session.quotationId !== row.quotationId) {
    if (s === "1") {
      return (
        <main className="mx-auto max-w-[720px] px-6 py-16">
          <h1 className="text-[26px]">We could not open your quotation</h1>
          <p className="mt-3 text-muted">Your browser did not keep the sign-in cookie. Enable cookies for this site and open the link again.</p>
        </main>
      );
    }
    redirect(`/api/portal/session/${token}`);
  }

  const quotation = await loadPortalQuotation(prisma, row.quotationId);
  if (quotation.customerId !== session.customerId) redirect("/portal/invalid?reason=missing");

  return <PortalDocument quotation={toPortalView(quotation)} validUntil={row.expiresAt.toISOString()} />;
}
