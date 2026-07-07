import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Refund Policy" };

export default function RefundsPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-10 sm:py-16">
      <h1 className="display text-3xl sm:text-4xl mb-6">Refund Policy</h1>
      <div className="space-y-6 text-sm text-ink-soft leading-relaxed">
        <p className="text-ink font-medium">
          If your government-issued document photo is rejected by the issuing
          authority, we refund you in full. No exceptions, no fine print.
        </p>
        <section>
          <h2 className="text-ink font-semibold text-base mb-2">How to request a refund</h2>
          <p>
            Email us your order number (shown on your download page and in
            your delivery email) and, if you have it, the rejection notice from
            the issuing authority. We process refunds within 2 business days.
          </p>
        </section>
        <section>
          <h2 className="text-ink font-semibold text-base mb-2">Before you request a reshoot instead</h2>
          <p>
            If your compliance checklist showed a WARN or FAIL before you paid,
            you already had a free opportunity to retake the photo. After
            payment, you get three free re-processing runs on the same photo
            set at no extra charge — often faster than a refund + new order.
          </p>
        </section>
        <section>
          <h2 className="text-ink font-semibold text-base mb-2">What isn&apos;t covered</h2>
          <p>
            Rejections caused by information you entered incorrectly (wrong
            document type or country selected), or issues unrelated to the
            photo itself, aren&apos;t covered by this guarantee — but email us
            anyway; we handle edge cases individually.
          </p>
        </section>
        <p>
          Questions before you buy? See our{" "}
          <Link href="/photo" className="text-accent underline underline-offset-2">
            photo formats
          </Link>{" "}
          or start a photo directly.
        </p>
      </div>
    </div>
  );
}
