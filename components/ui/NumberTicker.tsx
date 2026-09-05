"use client";

import { useEffect, useRef } from "react";

/**
 * Counts from the previous value to the new one over `duration` ms (§3.4 motion #1).
 * The animation writes to the DOM node directly — an effect synchronising an external
 * system — so a 60fps count-up never triggers 24 React renders.
 * Honours prefers-reduced-motion by jumping straight to the value.
 */
export function NumberTicker({
  value,
  format,
  duration = 400,
  className,
}: {
  value: number;
  format: (n: number) => string;
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const currentRef = useRef(value);

  useEffect(() => {
    const node = ref.current;
    const from = currentRef.current;
    const to = value;
    if (!node) return;
    if (from === to) {
      node.textContent = format(to);
      return;
    }

    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      currentRef.current = to;
      node.textContent = format(to);
      return;
    }

    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      const current = from + (to - from) * eased;
      currentRef.current = current;
      node.textContent = format(current);
      if (t < 1) raf = requestAnimationFrame(tick);
      else currentRef.current = to;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration, format]);

  // Server render and first paint show the exact value; the effect takes over on updates.
  // No font is imposed here: a figure inside a table wants mono, a headline figure wants
  // the display face. The caller decides, otherwise every big number ends up looking like code.
  return (
    <span ref={ref} className={className}>
      {format(value)}
    </span>
  );
}
