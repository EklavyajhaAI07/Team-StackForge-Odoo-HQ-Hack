/** Latest still-valid magic link for a quotation, if any. */
export function activePortalUrl(tokens: { token: string; expiresAt: Date }[], now = new Date()): string | null {
  const live = tokens.filter((t) => t.expiresAt.getTime() > now.getTime()).sort((a, b) => b.expiresAt.getTime() - a.expiresAt.getTime())[0];
  if (!live) return null;
  const base = process.env.APP_URL ?? "http://localhost:3000";
  return `${base}/portal/q/${live.token}`;
}
