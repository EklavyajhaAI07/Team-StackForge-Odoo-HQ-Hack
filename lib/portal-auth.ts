// PORTAL auth realm only. Separate secret, separate cookie, separate claims.
// This module never imports lib/auth.ts and internal routes never import this module.
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

export const PORTAL_COOKIE = "df_portal";
const REALM = "portal";

function secret(): Uint8Array {
  const s = process.env.PORTAL_JWT_SECRET;
  if (!s) throw new Error("PORTAL_JWT_SECRET is not set");
  return new TextEncoder().encode(s);
}

export type PortalSession = {
  customerId: string;
  quotationId: string;
  tokenId: string;
};

export async function createPortalSession(
  session: PortalSession,
  expiresAt: Date,
): Promise<void> {
  const jwt = await new SignJWT({
    realm: REALM,
    quotationId: session.quotationId,
    tokenId: session.tokenId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(session.customerId)
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(secret());
  const store = await cookies();
  store.set(PORTAL_COOKIE, jwt, {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
    expires: expiresAt,
  });
}

/** Portal session, or null. A token from the internal realm can never satisfy this. */
export async function getPortalSession(): Promise<PortalSession | null> {
  const store = await cookies();
  const token = store.get(PORTAL_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    if (
      payload.realm !== REALM ||
      typeof payload.sub !== "string" ||
      typeof payload.quotationId !== "string" ||
      typeof payload.tokenId !== "string"
    ) {
      return null;
    }
    return {
      customerId: payload.sub,
      quotationId: payload.quotationId,
      tokenId: payload.tokenId,
    };
  } catch {
    return null;
  }
}
