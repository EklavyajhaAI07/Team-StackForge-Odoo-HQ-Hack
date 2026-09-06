import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSessionUser } from "@/lib/auth";
import { activePortalUrl } from "@/lib/portal-url";
import { QuotationHeader } from "@/components/quotations/QuotationHeader";
import { QuotationTabs } from "@/components/quotations/QuotationTabs";
import { AuditTimeline } from "@/components/quotations/AuditTimeline";

export default async function QuotationLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireSessionUser();
  const q = await prisma.quotation.findUnique({
    where: { id },
    include: {
      customer: true,
      rep: { select: { name: true } },
      order: { select: { id: true, status: true } },
      approvals: { where: { status: "PENDING" }, select: { role: true } },
      portalTokens: { select: { token: true, expiresAt: true } },
      messages: { select: { authorType: true, lineId: true, counterDiscountPct: true, createdAt: true } },
    },
  });
  if (!q) notFound();

  const openCounters = q.messages.filter(
    (m) =>
      m.authorType === "CUSTOMER" &&
      m.counterDiscountPct != null &&
      !q.messages.some((r) => r.authorType === "REP" && r.lineId === m.lineId && r.createdAt > m.createdAt),
  ).length;

  return (
    <>
      <QuotationHeader quotation={q} portalUrl={activePortalUrl(q.portalTokens)} />
      <QuotationTabs id={q.id} pendingApproval={q.approvals.length > 0} openCounters={openCounters} hasOrder={!!q.order} />
      <div className="mt-5">{children}</div>
      <div className="mt-8">
        <AuditTimeline quotationId={q.id} orderId={q.order?.id ?? null} />
      </div>
    </>
  );
}
