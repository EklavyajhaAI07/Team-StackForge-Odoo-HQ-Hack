"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Input";
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "@/lib/demo-accounts";
import { roleLabel } from "@/lib/rbac";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function signIn(e: string, p: string) {
    setBusy(true);
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
      setError("Could not reach the server. Is `npm run dev` running?");
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(ev: FormEvent) {
    ev.preventDefault();
    void signIn(email, password);
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-6">
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
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
              placeholder="••••••••"
              required
            />
          </Field>
          <Button type="submit" variant="primary" size="lg" loading={busy} className="mt-1 w-full">
            Sign in
          </Button>
        </form>
      </Card>

      <Card className="p-4">
        <p className="mb-2 text-[13px] text-muted">
          Demo accounts — click one to sign in. Password is <span className="num">{DEMO_PASSWORD}</span> for all.
        </p>
        <ul className="flex flex-col">
          {DEMO_ACCOUNTS.map((a) => (
            <li key={a.email}>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setEmail(a.email);
                  setPassword(DEMO_PASSWORD);
                  void signIn(a.email, DEMO_PASSWORD);
                }}
                className="flex w-full items-center justify-between gap-3 rounded-[8px] px-2 py-2 text-left transition-colors hover:bg-raised disabled:opacity-60"
              >
                <span>
                  <span className="text-[14px] font-medium">{a.name}</span>
                  <span className="ml-2 text-[12px] text-muted">{a.blurb}</span>
                </span>
                <span className="pill bg-primary-soft text-primary">{roleLabel(a.role)}</span>
              </button>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
