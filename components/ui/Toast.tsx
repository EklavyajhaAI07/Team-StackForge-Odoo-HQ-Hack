"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { Tone } from "./Pill";
import { IconX } from "./icons";

export type ToastInput = {
  title: string;
  description?: string;
  tone?: Tone;
  durationMs?: number;
};

type ToastItem = ToastInput & { id: number };

type Ctx = { toast: (t: ToastInput) => void };

const ToastContext = createContext<Ctx | null>(null);

const toneBar: Record<Tone, string> = {
  neutral: "bg-muted",
  primary: "bg-primary",
  money: "bg-money",
  warn: "bg-warn",
  danger: "bg-danger",
  info: "bg-info",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (t: ToastInput) => {
      const id = ++counter.current;
      setItems((prev) => [...prev.slice(-3), { ...t, id }]);
      const ms = t.durationMs ?? 4200;
      window.setTimeout(() => dismiss(id), ms);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-5 right-5 z-[100] flex w-[360px] max-w-[calc(100vw-40px)] flex-col gap-2">
        {items.map((t) => (
          <div
            key={t.id}
            role="status"
            className="toast pointer-events-auto card card-raised flex items-start gap-3 overflow-hidden py-3 pl-4 pr-3 shadow-[0_8px_30px_rgba(0,0,0,0.35)]"
          >
            <span className={cn("mt-1 h-2 w-2 shrink-0 rounded-full", toneBar[t.tone ?? "primary"])} />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium leading-5">{t.title}</p>
              {t.description ? <p className="mt-0.5 text-[12px] leading-5 text-muted">{t.description}</p> : null}
            </div>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className="rounded p-1 text-muted hover:text-text"
              aria-label="Dismiss"
            >
              <IconX size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): Ctx {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Outside a provider (e.g. portal without toasts) — degrade to a no-op rather than crash.
    return { toast: () => {} };
  }
  return ctx;
}
