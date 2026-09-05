import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { LoginForm } from "@/components/auth/LoginForm";

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) redirect("/quotations");

  return (
    <div className="relative min-h-screen overflow-hidden lg:grid lg:grid-cols-[1.1fr_minmax(420px,0.9fr)]">
      {/* Left: what this thing actually does. Specific claims, not a weightless headline. */}
      <section className="relative hidden flex-col justify-between overflow-hidden border-r border-border px-12 py-12 lg:flex">
        <div className="ambient" aria-hidden />
        <div className="relative">
          <p className="display text-[15px] tracking-tight">
            DealFlow<span className="text-primary">360</span>
          </p>
        </div>

        <div className="relative max-w-[440px]">
          <h1 className="display text-[34px] leading-[1.12]">Discounts that route their own approvals.</h1>
          <p className="mt-4 text-[14px] leading-relaxed text-text-dim">
            Every quotation is scored against the discount ceiling for that customer&rsquo;s tier. What the score says decides
            who signs it off. Nobody chases an approver, and nothing reaches a customer unapproved.
          </p>
          <dl className="mt-9 grid grid-cols-3 gap-6 border-t border-border pt-6">
            <div>
              <dt className="text-[11px] text-muted">Routing</dt>
              <dd className="mt-1 text-[13px] text-text-dim">By blended risk</dd>
            </div>
            <div>
              <dt className="text-[11px] text-muted">Fulfilment</dt>
              <dd className="mt-1 text-[13px] text-text-dim">Split across warehouses</dd>
            </div>
            <div>
              <dt className="text-[11px] text-muted">Billing</dt>
              <dd className="mt-1 text-[13px] text-text-dim">One-time and recurring</dd>
            </div>
          </dl>
        </div>

        <p className="relative text-[11px] text-faint">Runs entirely on this machine. No external services.</p>
      </section>

      {/* Right: the form, aligned left rather than floating in the middle of a dark field. */}
      <section className="flex min-h-screen flex-col justify-center px-6 py-12 sm:px-12">
        <div className="w-full max-w-[360px]">
          <p className="display mb-9 text-[15px] tracking-tight lg:hidden">
            DealFlow<span className="text-primary">360</span>
          </p>
          <h2 className="text-[19px]">Sign in</h2>
          <p className="mt-1 text-[13px] text-muted">Use a work account to open the sales desk.</p>
          <LoginForm />
        </div>
      </section>
    </div>
  );
}
