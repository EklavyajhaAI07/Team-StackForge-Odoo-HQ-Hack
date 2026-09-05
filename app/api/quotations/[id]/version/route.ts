import { prisma } from "@/lib/db";
import { handle, json, requireUser } from "@/lib/api";

/** GET /api/quotations/[id]/version — cheap poll target for the 3s SSE fallback. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    await requireUser();
    const { id } = await ctx.params;
    const q = await prisma.quotation.findUnique({ where: { id }, select: { lastActivityAt: true, status: true } });
    if (!q) return json({ error: "Not found" }, { status: 404 });
    return json({ version: q.lastActivityAt.toISOString(), status: q.status });
  });
}
