import type { Metadata } from "next";
import "../globals.css";
import { fontClassNames } from "../fonts";

export const metadata: Metadata = {
  title: "Your quotation · DealFlow360",
  robots: { index: false, follow: false },
};

/**
 * Customer portal root layout — light, paper-like, no internal navigation, no internal auth.
 * This is a separate root layout on purpose: the portal never loads the internal shell.
 */
export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="portal" className={`${fontClassNames} h-full antialiased`}>
      <body className="min-h-full bg-bg text-text">{children}</body>
    </html>
  );
}
