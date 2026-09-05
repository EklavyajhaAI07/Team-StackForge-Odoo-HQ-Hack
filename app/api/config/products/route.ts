import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, authorize, handle, json, parseBody, requireUser } from "@/lib/api";
import { logAudit } from "@/lib/audit";

const createSchema = z.object({
  name: z.string().trim().min(2).max(120),
  sku: z.string().trim().min(2).max(40),
  categoryId: z.string().min(1),
  kind: z.enum(["ONE_TIME", "RECURRING"]),
  unit: z.string().trim().min(1).max(20),
  cost: z.number().int().min(0),
  listPrice: z.number().int().min(0),
  taxPct: z.number().min(0).max(100),
  description: z.string().trim().max(400).default(""),
  isPromoted: z.boolean().default(false),
  attributeName: z.string().trim().max(40).nullable().optional(),
});

const updateSchema = createSchema.partial().extend({ id: z.string().min(1) });

/** POST /api/config/products — add a product to the catalogue. */
export async function POST(req: Request) {
  return handle(async () => {
    const user = await requireUser();
    authorize(user, "config:all");
    const body = await parseBody(req, createSchema);
    if (body.listPrice < body.cost) throw new ApiError(400, "List price cannot be below cost");
    const clash = await prisma.product.findUnique({ where: { sku: body.sku } });
    if (clash) throw new ApiError(409, `SKU ${body.sku} is already in use`);

    const product = await prisma.$transaction(async (tx) => {
      const row = await tx.product.create({ data: { ...body, attributeName: body.attributeName ?? null } });
      await logAudit(tx, {
        entityType: "Product",
        entityId: row.id,
        actor: { type: "USER", id: user.id },
        action: "config-updated",
        meta: { message: `added ${row.name} (${row.sku})` },
      });
      return row;
    });
    return json({ ok: true, product }, { status: 201 });
  });
}

/** PATCH /api/config/products — edit pricing, promotion or description. */
export async function PATCH(req: Request) {
  return handle(async () => {
    const user = await requireUser();
    authorize(user, "config:all");
    const { id, ...changes } = await parseBody(req, updateSchema);
    if (Object.keys(changes).length === 0) throw new ApiError(400, "Change at least one field");

    const product = await prisma.$transaction(async (tx) => {
      const before = await tx.product.findUnique({ where: { id } });
      if (!before) throw new ApiError(404, "Product not found");
      const cost = changes.cost ?? before.cost;
      const listPrice = changes.listPrice ?? before.listPrice;
      if (listPrice < cost) throw new ApiError(400, "List price cannot be below cost");
      const row = await tx.product.update({ where: { id }, data: changes });
      await logAudit(tx, {
        entityType: "Product",
        entityId: row.id,
        actor: { type: "USER", id: user.id },
        action: "config-updated",
        meta: { message: `updated ${row.name}` },
      });
      return row;
    });
    return json({ ok: true, product });
  });
}
