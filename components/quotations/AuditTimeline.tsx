import { prisma } from "@/lib/db";
import { auditDetail, auditLabel } from "@/lib/audit-labels";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { Tone } from "@/components/ui/Pill";

const toneDot: Record<Tone, string> = {
  neutral: "bg-muted",
  primary: "bg-primary",
  money: "bg-money",
  warn: "bg-warn",
  danger: "bg-danger",
  info: "bg-info",
};

function toneFor(action: string): Tone {
  if (action.startsWith("auto-approved") || action === "approved" || action === "confirmed" || action === "payment-recorded" || action === "split-accepted" || action === "backorder-consolidated") return "money";
  if (action === "rejected" || action === "confirm-blocked") return "danger";
  if (action === "returned" || action === "sent-to-customer" || action === "rep-replied" || action === "invoice-generated") return "info";
  if (action === "sent-for-approval" || action.startsWith("re-entered") || action === "counter-proposed" || action === "nudge") return "warn";
  if (action === "counter-accepted" || action === "counter-declined") return "primary";
  return "neutral";
}

/** Every AuditEvent for this quotation (and its order), oldest first so the story reads top-down. */
export async function AuditTimeline({ quotationId, orderId }: { quotationId: string; orderId: string | null }) {
  const events = await prisma.auditEvent.findMany({
    where: {
      OR: [{ entityType: "Quotation", entityId: quotationId }, ...(orderId ? [{ entityType: "Order", entityId: orderId }] : [])],
    },
    orderBy: { createdAt: "asc" },
  });

  const userIds = [...new Set(events.filter((e) => e.actorType === "USER" && e.actorId).map((e) => e.actorId!))];
  const customerIds = [...new Set(events.filter((e) => e.actorType === "CUSTOMER" && e.actorId).map((e) => e.actorId!))];
  const [users, customers] = await Promise.all([
    userIds.length ? prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, role: true } }) : [],
    customerIds.length ? prisma.customer.findMany({ where: { id: { in: customerIds } }, select: { id: true, name: true, company: true } }) : [],
  ]);
  const userName = new Map(users.map((u) => [u.id, u.name]));
  const customerName = new Map(customers.map((c) => [c.id, `${c.name} (${c.company})`]));

  return (
    <section className="card">
      <div className="px-5 pt-4 pb-2">
        <h3>Audit timeline</h3>
        <p className="text-[13px] text-muted">Every approval, rejection and edit — who, when and why. Oldest first.</p>
      </div>
      {events.length === 0 ? (
        <p className="px-5 pb-5 text-[14px] text-muted">Nothing recorded yet.</p>
      ) : (
        <ol className="px-5 pb-5">
          {events.map((e, i) => {
            const actor =
              e.actorType === "USER"
                ? (userName.get(e.actorId ?? "") ?? "Unknown user")
                : e.actorType === "CUSTOMER"
                  ? (customerName.get(e.actorId ?? "") ?? "Customer")
                  : "System";
            const detail = auditDetail(e.action, e.meta as Record<string, unknown> | null);
            const tone = toneFor(e.action);
            return (
              <li key={e.id} className="relative flex gap-3 py-2">
                <div className="flex w-3 flex-col items-center">
                  <span className={cn("mt-[7px] h-2 w-2 shrink-0 rounded-full", toneDot[tone])} />
                  {i < events.length - 1 ? <span className="mt-1 w-px flex-1 bg-border" /> : null}
                </div>
                <div className="min-w-0 flex-1 pb-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <p className="text-[14px] font-medium">{auditLabel(e.action)}</p>
                    <p className="num text-[12px] text-muted">{formatDateTime(e.createdAt)}</p>
                  </div>
                  {detail ? <p className="mt-0.5 text-[13px] text-muted">{detail}</p> : null}
                  <p className="mt-0.5 text-[12px] text-muted">
                    by <span className="text-text">{actor}</span>
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
