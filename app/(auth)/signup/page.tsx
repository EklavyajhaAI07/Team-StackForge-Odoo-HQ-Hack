import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { SignupForm } from "@/components/auth/SignupForm";

export const metadata: Metadata = { title: "Create an account · DealFlow360" };

export default async function SignupPage() {
  const user = await getSessionUser();
  if (user) redirect("/quotations");

  return (
    <div className="relative min-h-screen overflow-hidden lg:grid lg:grid-cols-[1.1fr_minmax(420px,0.9fr)]">
      <section className="relative hidden flex-col justify-between overflow-hidden border-r border-border px-12 py-12 lg:flex">
        <div className="ambient" aria-hidden />
        <div className="relative">
          <p className="display text-[16px] tracking-tight">
            DealFlow<span className="text-primary">360</span>
          </p>
        </div>

        <div className="relative max-w-[440px]">
          <h1 className="display text-[38px] leading-[1.12]">Join the desk.</h1>
          <p className="mt-4 text-[15px] leading-relaxed text-text-dim">
            Your role decides what you see and what you can sign off. A rep builds and sends quotations, a manager clears
            the first approval step, and finance clears the second before an order reaches fulfilment and billing.
          </p>
          <dl className="mt-9 grid grid-cols-3 gap-6 border-t border-border pt-6">
            <div>
              <dt className="text-[12px] text-muted">Rep</dt>
              <dd className="mt-1 text-[14px] text-text-dim">Builds quotations</dd>
            </div>
            <div>
              <dt className="text-[12px] text-muted">Manager</dt>
              <dd className="mt-1 text-[14px] text-text-dim">Approves step one</dd>
            </div>
            <div>
              <dt className="text-[12px] text-muted">Finance</dt>
              <dd className="mt-1 text-[14px] text-text-dim">Approves step two</dd>
            </div>
          </dl>
        </div>

        <p className="relative text-[12px] text-faint">Runs entirely on this machine. No external services.</p>
      </section>

      <section className="flex min-h-screen flex-col justify-center px-6 py-12 sm:px-12">
        <div className="w-full max-w-[360px]">
          <p className="display mb-9 text-[16px] tracking-tight lg:hidden">
            DealFlow<span className="text-primary">360</span>
          </p>
          <h2 className="text-[22px]">Create an account</h2>
          <p className="mt-1 text-[14px] text-muted">Standard credentials, no email confirmation needed.</p>
          <SignupForm />
        </div>
      </section>
    </div>
  );
}
