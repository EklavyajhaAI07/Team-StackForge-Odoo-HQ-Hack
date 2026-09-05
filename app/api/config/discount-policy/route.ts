import { z } from "zod";
import { prisma } from "@/lib/db";
import { authorize, handle, json, parseBody, requireUser } from "@/lib/api";
import { logAudit } from "@/lib/audit";

const schema = z.object({
  cells: z
    .array(
      z.object({
        tier: z.enum(["BRONZE", "SILVER", "GOLD"]),
        categoryId: z.string().min(1),
        ceilingPct: z.number().min(0).max(100),
      }),
    )
    .min(1)
    .max(60),
});

/**
 * PUT /api/config/discount-policy — the tier × category ceiling grid.
 * Changing a ceiling changes what counts as an overage, so every later routing decision follows.
 */
export async function PUT(req: Request) {
  return handle(async () => {
    const user = await requireUser();
    authorize(user, "config:discounts");
    const { cells } = await parseBody(req, schema);

    const changed = await prisma.$transaction(async (tx) => {
      const before = await tx.discountPolicy.findMany();
      const previous = new Map(before.map((p) => [`${p.tier}:${p.categoryId}`, p.ceilingPct]));
      const diffs: { tier: string; categoryId: string; from: number | null; to: number }[] = [];

      for (const cell of cells) {
        const key = `${cell.tier}:${cell.categoryId}`;
        const from = previous.get(key) ?? null;
        if (from === cell.ceilingPct) continue;
        await tx.discountPolicy.upsert({
          where: { tier_categoryId: { tier: cell.tier, categoryId: cell.categoryId } },
          create: { tier: cell.tier, categoryId: cell.categoryId, ceilingPct: cell.ceilingPct },
          update: { ceilingPct: cell.ceilingPct },
        });
        diffs.push({ tier: cell.tier, categoryId: cell.categoryId, from, to: cell.ceilingPct });
      }

      if (diffs.length) {
        const categories = await tx.category.findMany({ select: { id: true, name: true } });
        const names = new Map(categories.map((c) => [c.id, c.name]));
        await logAudit(tx, {
          entityType: "Config",
          entityId: "discount-policy",
          actor: { type: "USER", id: user.id },
          action: "config-updated",
          meta: {
            message: diffs
              .map((d) => `${d.tier.toLowerCase()} ${names.get(d.categoryId) ?? d.categoryId}: ${d.from ?? "—"}% → ${d.to}%`)
              .join(", "),
            changes: diffs.length,
          },
        });
      }
      return diffs.length;
    });

    return json({ ok: true, changed });
  });
}
