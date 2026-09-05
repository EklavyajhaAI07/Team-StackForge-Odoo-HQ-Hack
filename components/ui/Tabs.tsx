"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type TabItem = { href: string; label: ReactNode; badge?: ReactNode; exact?: boolean };

export function Tabs({ items, className }: { items: TabItem[]; className?: string }) {
  const pathname = usePathname();
  return (
    <nav className={cn("flex items-center gap-0.5 overflow-x-auto border-b border-border", className)} aria-label="Sections">
      {items.map((it) => {
        const active = it.exact ? pathname === it.href : pathname === it.href || pathname.startsWith(it.href + "/");
        return (
          <Link
            key={it.href}
            href={it.href}
            className={cn(
              "-mb-px flex h-8 shrink-0 items-center gap-1.5 border-b px-2.5 text-[13px] transition-colors",
              active ? "border-text text-text" : "border-transparent text-muted hover:text-text-dim",
            )}
            aria-current={active ? "page" : undefined}
          >
            {it.label}
            {it.badge}
          </Link>
        );
      })}
    </nav>
  );
}
