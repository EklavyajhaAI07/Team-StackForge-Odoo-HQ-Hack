import { getSessionUser } from "@/lib/auth";
import { heartbeat, subscribe } from "@/lib/sse";

export const dynamic = "force-dynamic";

/** GET /api/events/[quotationId] — Server-Sent Events for internal users (§5.8). */
export async function GET(req: Request, ctx: { params: Promise<{ quotationId: string }> }) {
  const user = await getSessionUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { quotationId } = await ctx.params;

  let cleanup: (() => void) | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      cleanup = subscribe(quotationId, controller);
      controller.enqueue(new TextEncoder().encode(`event: ready\ndata: {"quotationId":"${quotationId}"}\n\n`));
      timer = setInterval(() => {
        if (!heartbeat(controller)) {
          if (timer) clearInterval(timer);
          cleanup?.();
        }
      }, 15_000);
      req.signal.addEventListener("abort", () => {
        if (timer) clearInterval(timer);
        cleanup?.();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });
    },
    cancel() {
      if (timer) clearInterval(timer);
      cleanup?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
