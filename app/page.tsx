import Link from "next/link";
import { PHOTO_SPECS, formatDimensions } from "@/data/photo-specs";

const POPULAR = [
  "us-passport",
  "schengen-visa",
  "uk-passport",
  "canada-passport",
  "india-passport",
  "australia-passport",
];

export default function HomePage() {
  const popular = PHOTO_SPECS.filter((s) => POPULAR.includes(s.id));

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <section className="py-16 sm:py-24 max-w-3xl">
        <p className="font-mono text-xs uppercase tracking-widest text-accent mb-4">
          Passport · Visa · ID — {PHOTO_SPECS.length} official formats
        </p>
        <h1 className="display text-5xl sm:text-6xl">
          A compliant document photo from one selfie.
        </h1>
        <p className="mt-6 text-lg text-ink-soft leading-relaxed max-w-xl">
          Take a photo on your phone. VisaShot removes the background, crops to
          the exact government spec, and checks compliance — in 60 seconds, for{" "}
          <span className="font-mono tnum">$4.99</span>. Rejected by the
          government? Full refund.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/create?spec=us-passport"
            className="inline-flex items-center h-11 px-6 rounded-md bg-accent text-white font-medium hover:bg-accent-hover transition-colors"
          >
            Start your photo
          </Link>
          <Link
            href="/photo"
            className="inline-flex items-center h-11 px-6 rounded-md border border-rule-strong text-ink font-medium hover:border-ink-faint transition-colors"
          >
            Browse all formats
          </Link>
        </div>
        <p className="mt-6 text-sm text-ink-faint">
          Photos auto-deleted in 7 days. Never used for anything else.
        </p>
      </section>

      <section className="pb-20">
        <h2 className="font-mono text-xs uppercase tracking-widest text-ink-faint mb-6">
          Popular formats
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {popular.map((spec) => (
            <Link
              key={spec.id}
              href={`/photo/${spec.id}`}
              className="group rounded-card border border-rule p-5 hover:shadow-card hover:border-rule-strong transition-all"
            >
              <p className="font-medium text-ink group-hover:text-accent transition-colors">
                {spec.displayName}
              </p>
              <p className="font-mono text-sm text-ink-faint mt-1 tnum">
                {formatDimensions(spec)} · {spec.bgColor.toUpperCase()} background
              </p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
