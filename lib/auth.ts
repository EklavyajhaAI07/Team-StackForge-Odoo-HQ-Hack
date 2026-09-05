// INTERNAL auth realm only. Portal auth lives in lib/portal-auth.ts and must never be imported here.
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import type { Role } from "@prisma/client";
import { prisma } from "./db";

export const INTERNAL_COOKIE = "df_internal";
const REALM = "internal";
const SESSION_HOURS = 12;

function secret(): Uint8Array {
  const s = process.env.INTERNAL_JWT_SECRET;
  if (!s) throw new Error("INTERNAL_JWT_SECRET is not set");
  return new TextEncoder().encode(s);
}

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
};

export async function createInternalSession(user: SessionUser): Promise<void> {
  const jwt = await new SignJWT({ realm: REALM, role: user.role, name: user.name })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_HOURS}h`)
    .sign(secret());
  const store = await cookies();
  store.set(INTERNAL_COOKIE, jwt, {
    httpOnly: true,
    sameSite: "lax",
    secure: false, // localhost only by design (§0 non-negotiable 4)
    path: "/",
    maxAge: SESSION_HOURS * 3600,
  });
}

export async function destroyInternalSession(): Promise<void> {
  const store = await cookies();
  store.delete(INTERNAL_COOKIE);
}

/**
 * For server pages: pages render concurrently with their layout, so a page must guard itself
 * rather than rely on the layout's redirect having happened first.
 */
export async function requireSessionUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

/** Returns the logged-in internal user, or null. Rejects anything that is not an internal-realm token. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(INTERNAL_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    if (payload.realm !== REALM || typeof payload.sub !== "string") return null;
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, name: true, email: true, role: true },
    });
    return user;
  } catch {
    return null;
  }
}
