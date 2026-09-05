"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "@/lib/demo-accounts";
import { roleLabel } from "@/lib/rbac";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function signIn(e: string, p: string, tag: string) {
    setBusy(tag);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: e, password: p }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Check the email and password and try again");
        return;
      }
      router.push("/quotations");
      router.refresh();
    } catch {
      setError("Could not reach the server. Is the dev server running?");
    } finally {
      setBusy(null);
    }
  }

  function onSubmit(ev: FormEvent) {
    ev.preventDefault();
    void signIn(email, password, "form");
  }

  return (
    <>
      <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-3.5">
        <Field label="Work email" htmlFor="email">
          <Input
            id="email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@dealflow.local"
            required
          />
        </Field>
        <Field label="Password" htmlFor="password" error={error}>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </Field>
        <Button type="submit" variant="primary" size="lg" loading={busy === "form"} className="mt-1 w-full">
          Sign in
        </Button>
      </form>

      <div className="mt-8 border-t border-border pt-5">
        <p className="text-[13px] text-muted">
          Demo accounts — password <span className="num text-text-dim">{DEMO_PASSWORD}</span>. Pick one to sign straight in.
        </p>
        <ul className="mt-2.5 flex flex-col">
          {DEMO_ACCOUNTS.map((a) => (
            <li key={a.email}>
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => {
                  setEmail(a.email);
                  setPassword(DEMO_PASSWORD);
                  void signIn(a.email, DEMO_PASSWORD, a.email);
                }}
                className="group flex w-full items-baseline justify-between gap-3 rounded-[6px] px-2 py-1.5 text-left transition-colors hover:bg-raised disabled:opacity-50"
              >
                <span className="flex min-w-0 items-baseline gap-2">
                  <span className="text-[14px] font-medium">{a.name}</span>
                  <span className="truncate text-[12px] text-faint">{a.blurb}</span>
                </span>
                <span className="shrink-0 text-[12px] text-muted group-hover:text-text-dim">{roleLabel(a.role)}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
