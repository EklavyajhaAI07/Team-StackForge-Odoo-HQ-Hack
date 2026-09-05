import type { Metadata } from "next";
import { redirect } from "next/navigation";
import "../globals.css";
import { fontClassNames } from "../fonts";
import { getSessionUser } from "@/lib/auth";
import { ToastProvider } from "@/components/ui/Toast";
import { TopNav } from "@/components/shell/TopNav";

export const metadata: Metadata = {
  title: { default: "DealFlow360", template: "%s · DealFlow360" },
  description: "Self-governing B2B sales operations",
};

/** Internal root layout: JWT-internal realm guard, dark theme, top nav (§3.5). */
export default async function InternalLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <html lang="en" data-theme="internal" className={`${fontClassNames} h-full antialiased`}>
      <body className="min-h-full">
        <ToastProvider>
          <TopNav user={user} />
          <main className="mx-auto w-full max-w-[1400px] px-5 py-5">{children}</main>
        </ToastProvider>
      </body>
    </html>
  );
}
