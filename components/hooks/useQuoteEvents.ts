"use client";

import { useRouter } from "next/navigation";
import { useEffect, useEffectEvent, useState } from "react";

export type QuoteEvent = { type: string; payload?: Record<string, unknown>; at?: string };

/**
 * §5.8 — subscribes to the quotation's SSE stream and refreshes the server components on each
 * event. If the stream errors, it falls back to polling the version endpoint every 3 seconds.
 * `onEvent` fires only for stream events, so the caller can flash a row and raise a toast.
 */
export function useQuoteEvents(quotationId: string, onEvent?: (event: QuoteEvent) => void) {
  const router = useRouter();
  const [connected, setConnected] = useState(false);
  // Keeps the latest callback without making the subscription depend on its identity.
  const notify = useEffectEvent((event: QuoteEvent) => onEvent?.(event));

  useEffect(() => {
    let source: EventSource | null = null;
    let poll: ReturnType<typeof setInterval> | null = null;
    let stopped = false;
    let lastVersion: string | null = null;

    const startPolling = () => {
      if (poll || stopped) return;
      poll = setInterval(async () => {
        try {
          const res = await fetch(`/api/quotations/${quotationId}/version`, { cache: "no-store" });
          if (!res.ok) return;
          const data = (await res.json()) as { version: string };
          if (lastVersion && data.version !== lastVersion) router.refresh();
          lastVersion = data.version;
        } catch {
          // Offline or the server is restarting; the next tick tries again.
        }
      }, 3000);
    };

    try {
      source = new EventSource(`/api/events/${quotationId}`);
      source.addEventListener("ready", () => setConnected(true));
      source.addEventListener("quote", (ev) => {
        try {
          const event = JSON.parse((ev as MessageEvent).data) as QuoteEvent;
          notify(event);
        } catch {
          // A malformed frame should still refresh the page.
        }
        router.refresh();
      });
      source.onerror = () => {
        setConnected(false);
        source?.close();
        source = null;
        startPolling();
      };
    } catch {
      startPolling();
    }

    return () => {
      stopped = true;
      source?.close();
      if (poll) clearInterval(poll);
    };
  }, [quotationId, router]);

  return { connected };
}
