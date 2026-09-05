import type { Metadata } from "next";
import "../globals.css";
import { fontClassNames } from "../fonts";

export const metadata: Metadata = {
  title: "Sign in · DealFlow360",
  description: "Self-governing B2B sales operations",
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="internal" className={`${fontClassNames} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
