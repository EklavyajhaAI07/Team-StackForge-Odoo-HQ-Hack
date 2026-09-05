import { getSessionUser } from "@/lib/auth";
import { handle, json } from "@/lib/api";

/** Realm probe used by the P1 acceptance check: only an internal-realm cookie yields a user. */
export async function GET() {
  return handle(async () => {
    const user = await getSessionUser();
    if (!user) return json({ user: null }, { status: 401 });
    return json({ user });
  });
}
