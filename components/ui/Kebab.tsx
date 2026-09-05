"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { IconDots } from "./icons";

export type KebabItem = {
  label: ReactNode;
  onSelect?: () => void;
  href?: string;
  danger?: boolean;
  disabled?: boolean;
};

export function Kebab({ items, align = "right", label = "More actions" }: { items: KebabItem[]; align?: "left" | "right"; label?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative inline-block" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="rounded p-1.5 text-muted hover:bg-raised hover:text-text"
      >
        <IconDots size={16} />
      </button>
      {open ? (
        <div
          role="menu"
          className={cn(
            "card card-raised absolute z-40 mt-1 min-w-[180px] py-1 shadow-[0_8px_30px_rgba(0,0,0,0.35)]",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          {items.map((it, i) =>
            it.href ? (
              <a
                key={i}
                role="menuitem"
                href={it.href}
                className={cn("block px-3 py-2 text-[13px] hover:bg-primary-soft", it.danger && "text-danger")}
              >
                {it.label}
              </a>
            ) : (
              <button
                key={i}
                role="menuitem"
                type="button"
                disabled={it.disabled}
                onClick={() => {
                  setOpen(false);
                  it.onSelect?.();
                }}
                className={cn(
                  "block w-full px-3 py-2 text-left text-[13px] hover:bg-primary-soft disabled:opacity-50",
                  it.danger && "text-danger",
                )}
              >
                {it.label}
              </button>
            ),
          )}
        </div>
      ) : null}
    </div>
  );
}
