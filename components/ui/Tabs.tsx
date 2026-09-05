"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type TabItem = { href: string; label: ReactNode; badge?: ReactNode; exact?: boolean };

export function Tabs({ items, className }: { items: TabItem[]; className?: string }) {
  const pathname = usePathname();
  return (
    <nav className={cn("flex items-center gap-1 border-b border-border", className)} aria-label="Sections">
      {items.map((it) => {
        const active = it.exact ? pathname === it.href : pathname === it.href || pathname.startsWith(it.href + "/");
        return (
          <Link
            key={it.href}
            href={it.href}
            className={cn(
              "-mb-px flex h-10 items-center gap-2 border-b-2 px-3 text-[13px] font-medium transition-colors",
              active ? "border-primary text-text" : "border-transparent text-muted hover:text-text",
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
