import { destroyInternalSession } from "@/lib/auth";
import { handle, json } from "@/lib/api";

export async function POST() {
  return handle(async () => {
    await destroyInternalSession();
    return json({ ok: true });
  });
}
