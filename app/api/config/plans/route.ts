import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, authorize, handle, json, parseBody, requireUser } from "@/lib/api";
import { logAudit } from "@/lib/audit";

const createSchema = z.object({
  name: z.string().trim().min(2).max(60),
  interval: z.enum(["MONTHLY", "QUARTERLY", "YEARLY"]),
  cancelRule: z.enum(["PRORATED_CREDIT", "NO_REFUND"]),
});

const updateSchema = createSchema.partial().extend({ id: z.string().min(1) });

/** POST /api/config/plans — add a subscription plan. */
export async function POST(req: Request) {
  return handle(async () => {
    const user = await requireUser();
    authorize(user, "config:all");
    const body = await parseBody(req, createSchema);
    const plan = await prisma.$transaction(async (tx) => {
      const row = await tx.subscriptionPlan.create({ data: body });
      await logAudit(tx, {
        entityType: "Config",
        entityId: row.id,
        actor: { type: "USER", id: user.id },
        action: "config-updated",
        meta: { message: `added plan ${row.name} (${row.interval.toLowerCase()}, ${row.cancelRule === "NO_REFUND" ? "no refund" : "prorated credit"})` },
      });
      return row;
    });
    return json({ ok: true, plan }, { status: 201 });
  });
}

/** PATCH /api/config/plans — change a plan's interval or cancellation rule. */
export async function PATCH(req: Request) {
  return handle(async () => {
    const user = await requireUser();
    authorize(user, "config:all");
    const { id, ...changes } = await parseBody(req, updateSchema);
    if (Object.keys(changes).length === 0) throw new ApiError(400, "Change at least one field");
    const plan = await prisma.$transaction(async (tx) => {
      const before = await tx.subscriptionPlan.findUnique({ where: { id } });
      if (!before) throw new ApiError(404, "Plan not found");
      const row = await tx.subscriptionPlan.update({ where: { id }, data: changes });
      await logAudit(tx, {
        entityType: "Config",
        entityId: row.id,
        actor: { type: "USER", id: user.id },
        action: "config-updated",
        meta: { message: `updated plan ${row.name}` },
      });
      return row;
    });
    return json({ ok: true, plan });
  });
}
