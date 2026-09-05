import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, authorize, handle, json, parseBody, requireUser } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { emit } from "@/lib/sse";

const schema = z.object({ reason: z.string().trim().max(300).optional().default("") });

/**
 * POST /api/quotations/[id]/nudge — the escalation action behind every deal-health card (§5.6).
 * It writes an audit event naming who nudged whom and why.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await ctx.params;
    const user = await requireUser();
    authorize(user, "nudge");
    const { reason } = await parseBody(req, schema);

    const result = await prisma.$transaction(async (tx) => {
      const q = await tx.quotation.findUnique({
        where: { id },
        select: { id: true, number: true, status: true, rep: { select: { id: true, name: true } } },
      });
      if (!q) throw new ApiError(404, "Quotation not found");
      await logAudit(tx, {
        entityType: "Quotation",
        entityId: q.id,
        actor: { type: "USER", id: user.id },
        action: "nudge",
        reason: reason || null,
        meta: { message: `${user.name} nudged ${q.rep.name}`, status: q.status },
      });
      return { number: q.number, repName: q.rep.name };
    });

    emit(id, { type: "nudge", payload: { repName: result.repName } });
    return json({ ok: true, ...result });
  });
}
