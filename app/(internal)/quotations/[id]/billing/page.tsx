import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSessionUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { getOrderForQuotation } from "@/lib/services/order";
import { Billing } from "@/components/billing/Billing";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata: Metadata = { title: "Billing" };

export default async function BillingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireSessionUser();
  const quotation = await prisma.quotation.findUnique({ where: { id }, select: { id: true } });
  if (!quotation) notFound();
  const order = await getOrderForQuotation(prisma, quotation.id);

  if (!order) {
    return <EmptyState title="Billing starts when the order is confirmed" description="Confirm this approved quotation first. One-time invoices and the next three recurring cycles are created automatically." />;
  }

  const lines = new Map(order.quotation.lines.map((line) => [line.id, line]));
  return (
    <Billing
      orderId={order.id}
      canManage={can(user, "billing:manage")}
      nowIso={new Date().toISOString()}
      invoices={order.invoices.map((invoice) => ({
        id: invoice.id,
        kind: invoice.kind,
        amount: invoice.amount,
        tax: invoice.tax,
        status: invoice.status,
        dueDate: invoice.dueDate?.toISOString() ?? null,
        payments: invoice.payments.map((payment) => ({ id: payment.id, amount: payment.amount, method: payment.method, paidAt: payment.paidAt.toISOString() })),
      }))}
      schedule={order.schedule.map((entry) => {
        const line = lines.get(entry.lineId);
        return {
          id: entry.id,
          lineId: entry.lineId,
          productName: line?.product.name ?? "Archived subscription line",
          planName: line?.plan?.name ?? "Subscription",
          billOn: entry.billOn.toISOString(),
          amount: entry.amount,
          status: entry.status as "SCHEDULED" | "INVOICED",
        };
      })}
      subscriptions={order.quotation.lines.filter((line) => line.isRecurring).map((line) => ({
        id: line.id,
        productName: line.product.name,
        qty: line.qty,
        netUnit: Math.round(line.unitPrice * (1 - line.discountPct / 100)),
        planName: line.plan?.name ?? "Subscription",
        cancelRule: (line.plan?.cancelRule ?? "PRORATED_CREDIT") as "PRORATED_CREDIT" | "NO_REFUND",
      }))}
    />
  );
}
