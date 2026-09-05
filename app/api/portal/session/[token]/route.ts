import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createPortalSession } from "@/lib/portal-auth";

/**
 * Magic-link resolver (§5.5): a valid, unexpired PortalToken → httpOnly portal-realm cookie
 * scoped to that quotation → redirect to the portal document. No internal auth is involved.
 */
export async function GET(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const url = new URL(req.url);
  const row = await prisma.portalToken.findUnique({ where: { token } });

  if (!row) return NextResponse.redirect(new URL("/portal/invalid?reason=missing", url.origin));
  if (row.expiresAt.getTime() < Date.now()) {
    return NextResponse.redirect(new URL("/portal/invalid?reason=expired", url.origin));
  }

  if (!row.usedAt) {
    await prisma.portalToken.update({ where: { id: row.id }, data: { usedAt: new Date() } });
  }
  await createPortalSession({ customerId: row.customerId, quotationId: row.quotationId, tokenId: row.id }, row.expiresAt);
  return NextResponse.redirect(new URL(`/portal/q/${token}?s=1`, url.origin));
}
