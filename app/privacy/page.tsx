import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-10 sm:py-16 prose-like">
      <h1 className="display text-3xl sm:text-4xl mb-6">Privacy Policy</h1>
      <div className="space-y-6 text-sm text-ink-soft leading-relaxed">
        <p>
          VisaShot processes your photo solely to produce a government-compliant
          document photo. This page explains what we collect, why, and how long
          we keep it.
        </p>

        <section>
          <h2 className="text-ink font-semibold text-base mb-2">What we collect</h2>
          <p>
            The photo you upload or capture, face landmark measurements computed
            in your browser (used only to compute the crop), your email address
            if you choose to receive your download or a pre-payment copy, and
            standard analytics events (see below) that never include your photo
            or face data.
          </p>
        </section>

        <section>
          <h2 className="text-ink font-semibold text-base mb-2">Data flow</h2>
          <p>
            Your browser → our server (Vercel) → Supabase Storage (private
            bucket) for the working copy → Replicate, a background-removal
            subprocessor, receives only the image bytes needed to remove the
            background, never your email or order details → the result returns
            to our server, which composes your final photo and deletes the
            Replicate-side copy per their retention policy.
          </p>
        </section>

        <section>
          <h2 className="text-ink font-semibold text-base mb-2">Retention — 7-day auto-delete</h2>
          <p>
            Your original photo, processed photo, and any print sheets are
            automatically deleted within 7 days of upload, enforced by a
            scheduled purge job and a storage bucket lifecycle rule. Order
            metadata (email, spec, amount, status) is retained longer for
            accounting and refund handling, with no photo attached.
          </p>
        </section>

        <section>
          <h2 className="text-ink font-semibold text-base mb-2">Subprocessors</h2>
          <p>
            Vercel (hosting), Supabase (database + storage), Replicate
            (background removal), Stripe (payments), Resend (email delivery),
            PostHog (product analytics), Sentry (error monitoring).
          </p>
        </section>

        <section>
          <h2 className="text-ink font-semibold text-base mb-2">Your face data specifically</h2>
          <p>
            We treat photos of your face as sensitive data. It is never used to
            train models, never sold, never shared beyond the subprocessors
            above, and never retained beyond the window stated here.
          </p>
        </section>

        <section>
          <h2 className="text-ink font-semibold text-base mb-2">Your rights</h2>
          <p>
            Email us to request early deletion of your order or a copy of the
            data we hold about it. Since we don&apos;t require an account, we
            verify requests against the email address on the order.
          </p>
        </section>
      </div>
    </div>
  );
}
