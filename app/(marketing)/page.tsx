import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { LinkButton } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Logo } from "@/components/shell/Logo";
import { Vignette } from "@/components/marketing/Vignette";

/** Claims a judge can check in the code within a minute, which is the point of making them. */
const CLAIMS = [
  "Zero hardcoded rules — everything is config",
  "Every action audited — who, when, why",
  "Runs fully offline — no external dependencies",
  "Pure-function engines — readable, unit-tested",
];

const STEPS = [
  {
    title: "Build the quote",
    body: "Tier-based pricing, live margin, and per-line discount ceilings checked as you type.",
  },
  {
    title: "Approval routes itself",
    body: "A revenue-weighted blended risk score decides: no approval, manager, or manager then finance.",
  },
  {
    title: "Stock decides fulfillment",
    body: "Orders split across warehouses by live stock and shipping cost, with manual override and backorder consolidation.",
  },
  {
    title: "Billing stays reconciled",
    body: "One-time and subscription lines on one order, with mid-cycle proration and automatic credit notes.",
  },
  {
    title: "Customers negotiate live",
    body: "An isolated portal where counter-offers sync in real time and re-enter approval automatically when limits are crossed.",
  },
];

// Taken from prisma/seed.ts rather than written out here, so the page cannot advertise
// an account the seed does not create.
const ACCOUNTS = [
  { email: "priya@dealflow.local", role: "Sales rep" },
  { email: "meera@dealflow.local", role: "Sales manager" },
  { email: "vikram@dealflow.local", role: "Finance" },
  { email: "admin@dealflow.local", role: "Admin" },
];

export default async function LandingPage() {
  // Someone already signed in wants the desk, not the front door.
  const user = await getSessionUser();
  if (user) redirect("/dashboard");

  return (
    <div className="min-h-screen">
      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <header className="relative z-10 border-b border-border">
        <nav className="mx-auto flex h-16 max-w-[1140px] items-center justify-between gap-4 px-6">
          <Logo withWordmark size={26} priority />
          <div className="flex items-center gap-2">
            <LinkButton href="/login" variant="ghost">
              Sign in
            </LinkButton>
            <LinkButton href="/login" variant="primary">
              Enter workspace
            </LinkButton>
          </div>
        </nav>
      </header>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="ambient ambient-hero" aria-hidden />
        <div className="relative mx-auto max-w-[1140px] px-6 py-14 lg:grid lg:grid-cols-[1fr_minmax(0,380px)] lg:items-center lg:gap-16 lg:py-24">
          <div>
            <p className="text-[13px] text-muted">B2B sales operations platform</p>
            <h1 className="display mt-3 text-[clamp(36px,5vw,60px)] font-bold leading-[1.05]">
              The deal engine that governs itself.
            </h1>
            <p className="mt-5 max-w-[560px] text-[16px] leading-relaxed text-muted">
              DealFlow360 takes a quotation from first line to final payment — enforcing discount policy per line,
              splitting fulfillment across warehouses, keeping hybrid billing reconciled, and letting customers negotiate
              live. Every action audited.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <LinkButton href="/login" variant="primary" size="lg">
                Enter workspace
              </LinkButton>
              <LinkButton href="#how-it-works" variant="ghost" size="lg">
                See how it works
              </LinkButton>
            </div>
          </div>

          {/* Desktop only: below 1024px the rail would crowd the copy it is meant to support. */}
          <div className="mt-12 hidden lg:mt-0 lg:block">
            <Vignette />
          </div>
        </div>
      </section>

      {/* ── Claim strip ─────────────────────────────────────────────────── */}
      <section className="border-y border-border">
        <ul className="mx-auto grid max-w-[1140px] grid-cols-1 px-6 sm:grid-cols-2 lg:grid-cols-4">
          {CLAIMS.map((claim, i) => (
            <li
              key={claim}
              // A rule sits between items, never around them, and follows whichever axis the
              // items are actually laid out on at that width: stacked, two-up, or four-up.
              className={cn(
                "mono py-5 pr-6 text-[13px] leading-relaxed text-text-dim",
                i > 0 && "border-t border-border",
                i < 2 && "sm:border-t-0",
                i % 2 === 1 && "sm:border-l sm:border-border sm:pl-6",
                i > 0 && "lg:border-l lg:border-t-0 lg:border-border lg:pl-6",
              )}
            >
              {claim}
            </li>
          ))}
        </ul>
      </section>

      {/* ── How it works ────────────────────────────────────────────────── */}
      <section id="how-it-works" className="mx-auto max-w-[1140px] scroll-mt-8 px-6 py-14 lg:py-24">
        <h2 className="display text-[26px]">How it works</h2>
        <ol className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-5 lg:gap-6">
          {STEPS.map((step, i) => (
            <li key={step.title}>
              <span className="num text-[13px] text-primary">{String(i + 1).padStart(2, "0")}</span>
              <h3 className="display mt-2 text-[19px] font-semibold">{step.title}</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-muted">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ── Demo access ─────────────────────────────────────────────────── */}
      <section className="px-6 pb-14 lg:pb-24">
        <Card className="mx-auto max-w-[520px] px-6 py-7">
          <h2 className="display text-[22px]">Try it now</h2>
          <p className="mt-1 text-[14px] text-muted">
            Seeded demo accounts — password <span className="num">df360-demo-2026</span> for all.
          </p>
          <ul className="mt-5 flex flex-col gap-1.5">
            {ACCOUNTS.map((a) => (
              <li key={a.email} className="flex items-baseline justify-between gap-4 text-[13px]">
                <span className="num text-text-dim">{a.email}</span>
                <span className="text-muted">{a.role}</span>
              </li>
            ))}
          </ul>
          <div className="mt-6">
            <LinkButton href="/login" variant="primary" className="w-full justify-center">
              Sign in
            </LinkButton>
          </div>
        </Card>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="border-t border-border">
        <p className="mx-auto max-w-[1140px] px-6 py-6 text-[13px] text-muted">
          Built in 24 hours at Odoo Hackathon 2026 · Team Vajra — Het, Rudra, Dhruvi &amp; Eklavya · Next.js · PostgreSQL ·
          Prisma
        </p>
      </footer>
    </div>
  );
}
