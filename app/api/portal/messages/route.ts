import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, handle, json, parseBody } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { emit } from "@/lib/sse";
import { assertPortalOpen, requirePortalSession } from "@/lib/services/portal";

const schema = z.object({
  lineId: z.string().min(1).nullable().optional(),
  body: z.string().trim().max(1000).default(""),
  counterDiscountPct: z.number().min(0).max(100).nullable().optional(),
});

/**
 * POST /api/portal/messages — the customer comments on a line and/or proposes a counter discount.
 * A counter moves the quotation to UNDER_NEGOTIATION and pushes an SSE event to the rep (§5.5).
 * This route never imports internal auth.
 */
export async function POST(req: Request) {
  return handle(async () => {
    const session = await requirePortalSession();
    const input = await parseBody(req, schema);
    if (!input.body && input.counterDiscountPct == null) {
      throw new ApiError(400, "Write a comment or propose a discount");
    }

    const result = await prisma.$transaction(async (tx) => {
      const q = await tx.quotation.findUnique({
        where: { id: session.quotationId },
        include: { lines: { include: { product: true } }, customer: true },
      });
      if (!q) throw new ApiError(404, "Quotation not found");
      if (q.customerId !== session.customerId) throw new ApiError(403, "That quotation belongs to another customer");
      assertPortalOpen(q.status);

      let lineName: string | null = null;
      if (input.lineId) {
        const line = q.lines.find((l) => l.id === input.lineId);
        if (!line) throw new ApiError(404, "That line is not on this quotation");
        lineName = line.product.name;
        if (input.counterDiscountPct != null && input.counterDiscountPct <= line.discountPct) {
          throw new ApiError(400, `You already have ${line.discountPct}% on this line — propose a higher number`);
        }
      } else if (input.counterDiscountPct != null) {
        throw new ApiError(400, "Pick the line you would like a better price on");
      }

      const message = await tx.portalMessage.create({
        data: {
          quotationId: q.id,
          lineId: input.lineId ?? null,
          authorType: "CUSTOMER",
          body: input.body || `Requested ${input.counterDiscountPct}% on ${lineName}`,
          counterDiscountPct: input.counterDiscountPct ?? null,
        },
      });

      // A counter reopens the negotiation; a plain comment leaves the status alone.
      let status = q.status;
      if (input.counterDiscountPct != null && q.status !== "UNDER_NEGOTIATION") {
        status = "UNDER_NEGOTIATION";
        await tx.quotation.update({ where: { id: q.id }, data: { status } });
      }

      await logAudit(tx, {
        entityType: "Quotation",
        entityId: q.id,
        actor: { type: "CUSTOMER", id: q.customerId },
        action: input.counterDiscountPct != null ? "counter-proposed" : "customer-comment",
        meta: {
          line: lineName ?? undefined,
          counterDiscountPct: input.counterDiscountPct ?? undefined,
          message: input.body || undefined,
        },
      });

      return { message, status, lineName, counter: input.counterDiscountPct ?? null };
    });

    emit(session.quotationId, {
      type: result.counter != null ? "counter-proposed" : "customer-comment",
      payload: {
        status: result.status,
        line: result.lineName,
        counterDiscountPct: result.counter,
        body: result.message.body,
      },
    });

    return json({ ok: true, status: result.status, messageId: result.message.id }, { status: 201 });
  });
}
