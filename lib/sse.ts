// In-memory Server-Sent Events hub (§5.8). One process, localhost — by design.
// Stored on globalThis so Next.js dev HMR does not drop live subscribers.

export type QuoteEvent = {
  type: string;
  payload?: Record<string, unknown>;
  at?: string;
};

type Controller = ReadableStreamDefaultController<Uint8Array>;
type Hub = Map<string, Set<Controller>>;

const g = globalThis as unknown as { __dfSseHub?: Hub };
const hub: Hub = g.__dfSseHub ?? (g.__dfSseHub = new Map());
const encoder = new TextEncoder();

export function subscribe(quotationId: string, controller: Controller): () => void {
  let set = hub.get(quotationId);
  if (!set) {
    set = new Set();
    hub.set(quotationId, set);
  }
  set.add(controller);
  return () => {
    const s = hub.get(quotationId);
    if (!s) return;
    s.delete(controller);
    if (s.size === 0) hub.delete(quotationId);
  };
}

export function emit(quotationId: string, event: QuoteEvent): void {
  const set = hub.get(quotationId);
  if (!set || set.size === 0) return;
  const data = `event: quote\ndata: ${JSON.stringify({ ...event, at: new Date().toISOString() })}\n\n`;
  const chunk = encoder.encode(data);
  for (const controller of set) {
    try {
      controller.enqueue(chunk);
    } catch {
      set.delete(controller);
    }
  }
}

export function heartbeat(controller: Controller): boolean {
  try {
    controller.enqueue(encoder.encode(`: ping\n\n`));
    return true;
  } catch {
    return false;
  }
}
