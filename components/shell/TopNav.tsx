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
    toast({ title: "Data reloaded", tone: "info", durationMs: 1600 });
  }

  const initials = user.name
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const onBackend = pathname.startsWith("/backend");

  return (
    <header className="no-print sticky top-0 z-50 border-b border-border bg-bg/85 backdrop-blur-md">
      <div className="mx-auto flex h-11 w-full max-w-[1400px] items-center justify-between gap-6 px-5">
        <div className="flex min-w-0 items-center gap-5">
          <Link href="/quotations" className="display shrink-0 text-[14px] tracking-tight">
            DealFlow<span className="text-primary">360</span>
          </Link>
          <nav className="flex items-center gap-0.5" aria-label="Primary">
            {NAV.map((n) => {
              const active = pathname === n.href || pathname.startsWith(n.href + "/");
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={cn(
                    "relative flex h-11 items-center px-2.5 text-[14px] transition-colors",
                    active ? "text-text" : "text-muted hover:text-text-dim",
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  {n.label}
                  {/* The active tab is marked by a rule on the nav's own edge, not a filled chip. */}
                  {active ? <span className="absolute inset-x-2 -bottom-px h-px bg-text" /> : null}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-1">
          <button type="button" onClick={reload} className="btn btn-ghost btn-sm" title="Re-fetch everything on this page">
            <IconRefresh size={13} />
            <span className="hidden lg:inline">Reload</span>
          </button>
          <Link href="/backend" className={cn("btn btn-ghost btn-sm", onBackend && "bg-raised text-text")}>
            <IconGrid size={13} />
            <span className="hidden lg:inline">Backend</span>
          </Link>
          <button type="button" onClick={closeWorkspace} disabled={closing} className="btn btn-ghost btn-sm" title="Sign out">
            <IconLogout size={13} />
            <span className="hidden lg:inline">Sign out</span>
          </button>
          <div className="ml-2 flex items-center gap-2 border-l border-border pl-3">
            <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-primary-soft text-[11px] font-semibold text-primary">
              {initials}
            </span>
            <span className="hidden text-[14px] md:inline">{user.name}</span>
            <span className="hidden text-[12px] text-faint lg:inline">{roleLabel(user.role)}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
