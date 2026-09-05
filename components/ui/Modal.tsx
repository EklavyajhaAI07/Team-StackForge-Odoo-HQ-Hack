"use client";

import { useEffect, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { IconX } from "./icons";

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = 520,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  width?: number;
  className?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/55" onClick={onClose} />
      <div
        className={cn("card card-raised relative flex max-h-[calc(100vh-32px)] w-full flex-col rounded-[16px]", className)}
        style={{ maxWidth: width }}
      >
        <div className="flex items-start justify-between gap-4 px-5 pt-5">
          <div>
            <h3 className="text-[17px] font-semibold tracking-tight">{title}</h3>
            {description ? <p className="mt-1 text-[14px] text-muted">{description}</p> : null}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 text-muted hover:text-text">
            <IconX size={16} />
          </button>
        </div>
        <div className="overflow-auto px-5 py-4">{children}</div>
        {footer ? <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-4">{footer}</div> : null}
      </div>
    </div>
  );
}
