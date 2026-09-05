import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, authorize, handle, json, parseBody, requireUser } from "@/lib/api";
import { logAudit } from "@/lib/audit";

const createSchema = z.object({
  name: z.string().trim().min(2).max(80),
  city: z.string().trim().min(2).max(80),
  shippingCostWeight: z.number().int().min(0).max(100_000_000),
});

const updateSchema = createSchema.partial().extend({ id: z.string().min(1) });

/** POST /api/config/warehouses — add a warehouse. */
export async function POST(req: Request) {
  return handle(async () => {
    const user = await requireUser();
    authorize(user, "config:all");
    const body = await parseBody(req, createSchema);
    const warehouse = await prisma.$transaction(async (tx) => {
      const row = await tx.warehouse.create({ data: body });
      await logAudit(tx, {
        entityType: "Warehouse",
        entityId: row.id,
        actor: { type: "USER", id: user.id },
        action: "config-updated",
        meta: { message: `added ${row.name} in ${row.city}` },
      });
      return row;
    });
    return json({ ok: true, warehouse }, { status: 201 });
  });
}

/** PATCH /api/config/warehouses — rename, move or re-price a warehouse. */
export async function PATCH(req: Request) {
  return handle(async () => {
    const user = await requireUser();
    authorize(user, "config:all");
    const { id, ...changes } = await parseBody(req, updateSchema);
    if (Object.keys(changes).length === 0) throw new ApiError(400, "Change at least one field");
    const warehouse = await prisma.$transaction(async (tx) => {
      const before = await tx.warehouse.findUnique({ where: { id } });
      if (!before) throw new ApiError(404, "Warehouse not found");
      const row = await tx.warehouse.update({ where: { id }, data: changes });
      await logAudit(tx, {
        entityType: "Warehouse",
        entityId: row.id,
        actor: { type: "USER", id: user.id },
        action: "config-updated",
        meta: { message: `updated ${row.name}` },
      });
      return row;
    });
    return json({ ok: true, warehouse });
  });
}
