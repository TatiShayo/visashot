import type { Metadata } from "next";

export const metadata: Metadata = { title: "Terms of Service" };

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-10 sm:py-16">
      <h1 className="display text-3xl sm:text-4xl mb-6">Terms of Service</h1>
      <div className="space-y-6 text-sm text-ink-soft leading-relaxed">
        <section>
          <h2 className="text-ink font-semibold text-base mb-2">The service</h2>
          <p>
            VisaShot converts a photo you provide into a document photo cropped
            and formatted to a specific government or organizational
            specification, and runs an automated compliance checklist against
            that spec. VisaShot is a formatting and pre-check tool, not a
            government agency, and does not submit anything on your behalf.
          </p>
        </section>
        <section>
          <h2 className="text-ink font-semibold text-base mb-2">No guarantee of acceptance</h2>
          <p>
            Final acceptance of any photo is always at the sole discretion of
            the issuing authority (embassy, passport office, visa processor, or
            other body). VisaShot assists with compliance to published
            specifications but cannot guarantee a specific authority&apos;s
            decision. See our refund policy for what happens if a photo is
            rejected.
          </p>
        </section>
        <section>
          <h2 className="text-ink font-semibold text-base mb-2">Your responsibilities</h2>
          <p>
            You confirm the photo is of yourself (or a person you have
            authority to act for, e.g. your child), that you own the rights to
            upload it, and that the information you provide (email, document
            expiry date) is accurate.
          </p>
        </section>
        <section>
          <h2 className="text-ink font-semibold text-base mb-2">Payments</h2>
          <p>
            Prices are shown before checkout in USD. Payment is processed by
            Stripe; we never see or store your card details. Orders are
            fulfilled automatically once payment is confirmed.
          </p>
        </section>
        <section>
          <h2 className="text-ink font-semibold text-base mb-2">Limitation of liability</h2>
          <p>
            VisaShot is provided &ldquo;as is.&rdquo; To the extent permitted by
            law, our liability for any claim relating to the service is limited
            to the amount you paid for the order in question.
          </p>
        </section>
        <section>
          <h2 className="text-ink font-semibold text-base mb-2">Changes</h2>
          <p>
            We may update these terms as the service evolves; material changes
            will be reflected on this page with an updated date.
          </p>
        </section>
      </div>
    </div>
  );
}
