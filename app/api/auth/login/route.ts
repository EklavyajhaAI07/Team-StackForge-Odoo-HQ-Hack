import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createInternalSession } from "@/lib/auth";
import { ApiError, handle, json, parseBody } from "@/lib/api";

const schema = z.object({
  email: z.string().trim().toLowerCase().min(3),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  return handle(async () => {
    const { email, password } = await parseBody(req, schema);
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new ApiError(401, "No account with that email");
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new ApiError(401, "That password is not right");
    await createInternalSession({ id: user.id, name: user.name, email: user.email, role: user.role });
    return json({ ok: true, user: { id: user.id, name: user.name, role: user.role } });
  });
}
