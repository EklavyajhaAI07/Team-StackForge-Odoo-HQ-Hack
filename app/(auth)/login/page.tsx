import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { LoginForm } from "@/components/auth/LoginForm";

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) redirect("/quotations");

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-6 py-12">
      {/* The only ambient animation in the app (§3.3) */}
      <div className="ambient" aria-hidden />
      <div className="relative z-10 w-full max-w-[420px]">
        <div className="mb-8">
          <p className="display text-[30px] font-bold tracking-tight">DealFlow360</p>
          <p className="mt-1 text-[14px] text-muted">Self-governing sales operations. Discounts route themselves.</p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
