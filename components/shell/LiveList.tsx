"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Keeps a list screen current without a manual reload.
 *
 * The per-quotation SSE stream only reaches someone who has that quotation open. An approver
 * sits on the list or the dashboard, so a customer's counter would otherwise wait for them to
 * refresh. There is no list-wide stream to subscribe to — a quotation is the unit of
 * subscription — so this refetches the server components on an interval instead.
 *
 * It stops while the tab is hidden: a background tab polling the database all afternoon is
 * cost with no reader.
 */
export function LiveList({ seconds = 6 }: { seconds?: number }) {
  const router = useRouter();

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      if (timer) return;
      timer = setInterval(() => router.refresh(), seconds * 1000);
    };
    const stop = () => {
      if (!timer) return;
      clearInterval(timer);
      timer = null;
    };

    const onVisibility = () => {
      if (document.hidden) {
        stop();
      } else {
        // Catch up immediately on return, rather than waiting out a whole interval.
        router.refresh();
        start();
      }
    };

    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [router, seconds]);

  return null;
}
