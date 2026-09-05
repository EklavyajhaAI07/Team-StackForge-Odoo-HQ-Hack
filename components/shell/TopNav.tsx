"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/cn";
import type { SessionUser } from "@/lib/auth";
import { roleLabel } from "@/lib/rbac";
import { useToast } from "@/components/ui/Toast";
import { IconLogout, IconRefresh, IconGrid } from "@/components/ui/icons";

const NAV = [
  { href: "/quotations", label: "Quotations" },
  { href: "/pipeline", label: "Pipeline" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/reports", label: "Reports" },
];

export function TopNav({ user }: { user: SessionUser }) {
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useToast();
  const [closing, setClosing] = useState(false);

  async function closeWorkspace() {
    setClosing(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  function reload() {
    router.refresh();
    toast({ title: "Data reloaded", tone: "info", durationMs: 1800 });
  }

  const initials = user.name
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="no-print sticky top-0 z-50 border-b border-border bg-bg/90 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-[1440px] items-center justify-between px-6">
        <div className="flex items-center gap-6">
          <Link href="/quotations" className="display text-[17px] font-bold tracking-tight">
            DealFlow360
          </Link>
          <nav className="flex items-center gap-1" aria-label="Primary">
            {NAV.map((n) => {
              const active = pathname === n.href || pathname.startsWith(n.href + "/");
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={cn(
                    "rounded-[8px] px-3 py-1.5 text-[13px] font-medium transition-colors",
                    active ? "bg-raised text-text" : "text-muted hover:text-text",
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-1">
          <button type="button" onClick={reload} className="btn btn-ghost btn-sm" title="Re-fetch everything on this page">
            <IconRefresh size={14} />
            Reload data
          </button>
          <Link
            href="/backend"
            className={cn("btn btn-ghost btn-sm", pathname.startsWith("/backend") && "bg-raised text-text")}
          >
            <IconGrid size={14} />
            Go to backend
          </Link>
          <button type="button" onClick={closeWorkspace} disabled={closing} className="btn btn-ghost btn-sm">
            <IconLogout size={14} />
            Close workspace
          </button>
          <div className="ml-3 flex items-center gap-2 rounded-full border border-border bg-surface py-1 pl-1 pr-3">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-soft text-[11px] font-semibold text-primary">
              {initials}
            </span>
            <span className="text-[13px] font-medium">{user.name}</span>
            <span className="text-[12px] text-muted">{roleLabel(user.role)}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
