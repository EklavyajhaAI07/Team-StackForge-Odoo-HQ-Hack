import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { ApiError, authorize, handle, json, requireUser } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { emit } from "@/lib/sse";
import { requireQuotation } from "@/lib/services/quotation";

const TOKEN_HOURS = 72;

/**
 * POST /api/quotations/[id]/send — "Send to customer": mints a 72h magic link (§5.5).
 * No email is sent; the URL is shown to the rep to copy.
 */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await ctx.params;
    const user = await requireUser();

    const result = await prisma.$transaction(async (tx) => {
      const q = await requireQuotation(tx, id);
      authorize(user, "quotation:send", { repId: q.repId });
      // A draft can be shared so the customer can read and comment on it while it is still
      // being built. What approval gates is CONFIRMATION, not viewing — the portal refuses to
      // confirm a draft or anything mid-approval, so no unapproved terms can become an order.
      if (!["DRAFT", "APPROVED", "SENT", "UNDER_NEGOTIATION"].includes(q.status)) {
        throw new ApiError(409, "A rejected or confirmed quotation cannot be sent to the customer");
      }
      const token = randomBytes(24).toString("base64url");
      const expiresAt = new Date(Date.now() + TOKEN_HOURS * 3_600_000);
      await tx.portalToken.create({ data: { token, customerId: q.customerId, quotationId: q.id, expiresAt } });
      const status = q.status === "APPROVED" ? "SENT" : q.status;
      await tx.quotation.update({ where: { id: q.id }, data: { status } });
      await logAudit(tx, {
        entityType: "Quotation",
        entityId: q.id,
        actor: { type: "USER", id: user.id },
        action: "sent-to-customer",
        meta: { expiresAt: expiresAt.toISOString(), customer: q.customer.company },
      });
      return { token, expiresAt, status };
    });

    const base = process.env.APP_URL ?? "http://localhost:3000";
    emit(id, { type: "status-changed", payload: { status: result.status } });
    return json({ url: `${base}/portal/q/${result.token}`, expiresAt: result.expiresAt, status: result.status });
  });
}
