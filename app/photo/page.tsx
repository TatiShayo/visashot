import type { Metadata } from "next";
import Link from "next/link";
import { listSpecs, formatDimensions } from "@/data/photo-specs";

export const metadata: Metadata = {
  title: "All passport, visa & ID photo formats",
  description:
    "Browse every country and document format VisaShot supports — passport, visa, residency and ID photos, each auto-cropped and compliance-checked to the official spec.",
};

export default function AllPhotoTypesPage() {
  const specs = listSpecs();
  const byCountry = new Map<string, typeof specs>();
  for (const s of specs) {
    const list = byCountry.get(s.country) ?? [];
    list.push(s);
    byCountry.set(s.country, list);
  }
  const countries = Array.from(byCountry.keys()).sort();

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-10 sm:py-16">
      <p className="font-mono text-xs uppercase tracking-widest text-accent mb-3">
        {specs.length} official formats
      </p>
      <h1 className="display text-4xl sm:text-5xl mb-4">All photo formats</h1>
      <p className="text-ink-soft max-w-2xl mb-10">
        Every format is auto-cropped to the official pixel dimensions and
        background color, then compliance-checked before you pay.
      </p>

      <div className="space-y-10">
        {countries.map((country) => (
          <section key={country}>
            <h2 className="font-mono text-xs uppercase tracking-widest text-ink-faint mb-3">
              {country}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {byCountry.get(country)!.map((spec) => (
                <Link
                  key={spec.id}
                  href={`/photo/${spec.id}`}
                  className="rounded-card border border-rule p-4 hover:border-rule-strong hover:shadow-card transition-all"
                >
                  <p className="font-medium text-ink">{spec.displayName}</p>
                  <p className="font-mono text-xs text-ink-faint mt-1 tnum">
                    {formatDimensions(spec)}
                    {spec.beta ? " · beta" : ""}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
