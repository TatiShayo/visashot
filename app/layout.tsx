import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { env } from "@/lib/env";

export const metadata: Metadata = {
  metadataBase: new URL(env.appUrl),
  title: {
    default: "VisaShot — Government-Compliant Passport & Visa Photos Online",
    template: "%s | VisaShot",
  },
  description:
    "Turn a phone selfie into a government-compliant passport, visa or ID photo in 60 seconds. Auto background removal, exact crop to official specs, compliance checked. $4.99, refund if rejected.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="font-sans min-h-screen flex flex-col">
        <header className="border-b border-rule">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 h-14 flex items-center justify-between">
            <Link
              href="/"
              className="font-mono text-sm font-semibold tracking-tight text-ink"
            >
              VISA<span className="text-accent">SHOT</span>
            </Link>
            <nav className="flex items-center gap-6 text-sm text-ink-soft">
              <Link href="/photo" className="hover:text-ink transition-colors">
                All photo types
              </Link>
              <Link
                href="/create"
                className="inline-flex items-center h-9 px-4 rounded-md bg-accent text-white font-medium hover:bg-accent-hover transition-colors"
              >
                Start your photo
              </Link>
            </nav>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-rule mt-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10 text-sm text-ink-faint space-y-4">
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              <Link href="/photo" className="hover:text-ink transition-colors">
                Photo types
              </Link>
              <Link href="/vs/pharmacy-passport-photos" className="hover:text-ink transition-colors">
                vs. pharmacy photos
              </Link>
              <Link href="/privacy" className="hover:text-ink transition-colors">
                Privacy
              </Link>
              <Link href="/terms" className="hover:text-ink transition-colors">
                Terms
              </Link>
              <Link href="/refunds" className="hover:text-ink transition-colors">
                Refund policy
              </Link>
            </div>
            <p className="max-w-3xl leading-relaxed">
              VisaShot assists with photo compliance. Final acceptance of any
              photo is always at the discretion of the issuing authority.
              Photos are processed solely to generate your document photo and
              are automatically deleted within 7 days.
            </p>
            <p className="font-mono text-xs">
              © {new Date().getFullYear()} VisaShot
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
