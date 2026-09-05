import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createInternalSession } from "@/lib/auth";
import { ApiError, handle, json, parseBody } from "@/lib/api";

/**
 * A1 — internal users register with standard credentials.
 *
 * DECISION: self-registration cannot mint an ADMIN. Admin holds the backend configuration
 * that every engine reads, so handing it out to anyone who knows the URL would make the
 * governance story meaningless. The three operating roles are open; the seeded
 * admin@dealflow.local covers the configuration demo.
 */
const schema = z.object({
  name: z.string().trim().min(2, "Enter your full name").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid work email"),
  password: z.string().min(8, "Use at least 8 characters"),
  role: z.enum(["SALES_REP", "SALES_MANAGER", "FINANCE"]).default("SALES_REP"),
});

export async function POST(req: Request) {
  return handle(async () => {
    const { name, email, password, role } = await parseBody(req, schema);

    const taken = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (taken) throw new ApiError(409, "That email already has an account — sign in instead");

    const user = await prisma.user.create({
      data: { name, email, role, passwordHash: await bcrypt.hash(password, 10) },
      select: { id: true, name: true, email: true, role: true },
    });

    // Straight into the workspace; a fresh account should not have to log in twice.
    await createInternalSession(user);
    return json({ ok: true, user }, { status: 201 });
  });
}
