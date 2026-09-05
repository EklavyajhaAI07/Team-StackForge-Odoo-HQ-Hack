"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Input";

const ROLES = [
  { value: "SALES_REP", label: "Sales rep", hint: "Builds and sends quotations" },
  { value: "SALES_MANAGER", label: "Sales manager", hint: "Approves step one, sets discount ceilings" },
  { value: "FINANCE", label: "Finance", hint: "Approves step two, fulfilment and billing" },
];

export function SignupForm() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "SALES_REP" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const tooShort = form.password.length > 0 && form.password.length < 8;

  async function onSubmit(ev: FormEvent) {
    ev.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not create the account");
        return;
      }
      router.push("/quotations");
      router.refresh();
    } catch {
      setError("Could not reach the server. Is the dev server running?");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-3.5">
        <Field label="Full name" htmlFor="name">
          <Input id="name" value={form.name} onChange={set("name")} placeholder="Priya Sharma" autoComplete="name" required />
        </Field>
        <Field label="Work email" htmlFor="email">
          <Input id="email" type="email" value={form.email} onChange={set("email")} placeholder="you@dealflow.local" autoComplete="username" required />
        </Field>
        <Field label="Password" htmlFor="password" hint="At least 8 characters" error={tooShort ? "At least 8 characters" : undefined}>
          <Input id="password" type="password" value={form.password} onChange={set("password")} autoComplete="new-password" required />
        </Field>
        <Field label="Role" htmlFor="role" hint={ROLES.find((r) => r.value === form.role)?.hint}>
          <Select id="role" value={form.role} onChange={set("role")}>
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </Select>
        </Field>

        {error ? <p className="text-[13px] text-danger">{error}</p> : null}

        <Button type="submit" variant="primary" size="lg" loading={busy} disabled={tooShort} className="mt-1 w-full">
          Create account
        </Button>
      </form>

      <p className="mt-5 text-[13px] text-muted">
        Already have an account?{" "}
        <Link href="/login" className="text-text underline underline-offset-2">
          Sign in
        </Link>
      </p>
      <p className="mt-2 text-[12px] text-faint">
        Backend configuration is admin-only. Use the seeded admin account to reach it.
      </p>
    </>
  );
}
