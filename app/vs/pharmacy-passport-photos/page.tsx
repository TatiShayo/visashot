import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "VisaShot vs. Pharmacy Passport Photos",
  description:
    "Honest comparison: $4.99 at home with VisaShot vs. ~$17 at a pharmacy or photo counter. Same compliance, faster, no trip required.",
};

const faqs = [
  {
    q: "Is a photo I take at home actually accepted?",
    a: "Yes — government agencies don't require the photo be taken by a professional. They require it to meet exact size, background and pose specifications, which is exactly what VisaShot's crop and compliance engine checks before you pay.",
  },
  {
    q: "What if my photo gets rejected anyway?",
    a: "VisaShot offers a full refund if your government-issued document photo is rejected by the issuing authority.",
  },
  {
    q: "How much faster is it?",
    a: "Most people finish in under two minutes, with no trip, no waiting in line, and no printing required unless you want a physical copy.",
  },
];

export default function VsPharmacyPage() {
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-10 sm:py-16">
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <p className="font-mono text-xs uppercase tracking-widest text-accent mb-3">Comparison</p>
      <h1 className="display text-4xl sm:text-5xl mb-6">
        VisaShot vs. pharmacy passport photos
      </h1>
      <p className="text-lg text-ink-soft leading-relaxed max-w-xl mb-10">
        A pharmacy or photo counter charges roughly $17 and requires a trip.
        VisaShot does the same government-compliant crop and background
        replacement from a phone selfie, for $4.99, in about 60 seconds.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse min-w-[480px]">
          <thead>
            <tr className="border-b border-rule-strong text-left">
              <th className="py-3 pr-4 text-ink-faint font-normal">&nbsp;</th>
              <th className="py-3 pr-4 font-semibold text-ink">VisaShot</th>
              <th className="py-3 font-semibold text-ink">Pharmacy / photo counter</th>
            </tr>
          </thead>
          <tbody>
            <Row label="Price" a="$4.99" b="~$17" />
            <Row label="Time" a="~60 seconds" b="Trip + wait in line" />
            <Row label="Availability" a="Any time, any device" b="Store hours only" />
            <Row label="Compliance check" a="Automated checklist before you pay" b="Staff judgment, varies by location" />
            <Row label="Guarantee" a="Full refund if rejected" b="Store-dependent, rarely offered" />
            <Row label="Print sheet" a="Included (4×6 + A4, cut guides)" b="Extra charge, if offered" />
          </tbody>
        </table>
      </div>

      <div className="mt-10">
        <Link
          href="/create"
          className="inline-flex items-center h-11 px-6 rounded-md bg-accent text-white font-medium hover:bg-accent-hover transition-colors"
        >
          Start your photo — $4.99
        </Link>
      </div>

      <section className="mt-14">
        <h2 className="font-mono text-xs uppercase tracking-widest text-ink-faint mb-4">FAQ</h2>
        <div className="space-y-4">
          {faqs.map((f) => (
            <div key={f.q}>
              <p className="font-medium text-ink">{f.q}</p>
              <p className="text-sm text-ink-soft mt-1 leading-relaxed">{f.a}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Row({ label, a, b }: { label: string; a: string; b: string }) {
  return (
    <tr className="border-b border-rule">
      <td className="py-3 pr-4 text-ink-faint">{label}</td>
      <td className="py-3 pr-4 text-ink">{a}</td>
      <td className="py-3 text-ink-soft">{b}</td>
    </tr>
  );
}
