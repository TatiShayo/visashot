import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  listSpecs,
  getSpec,
  relatedSpecs,
  formatDimensions,
  formatPixels,
} from "@/data/photo-specs";

export function generateStaticParams() {
  return listSpecs().map((s) => ({ specId: s.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ specId: string }>;
}): Promise<Metadata> {
  const { specId } = await params;
  const spec = getSpec(specId);
  if (!spec) return {};
  const title = `${spec.displayName} Online — ${formatDimensions(spec)}, App-Approved`;
  const description = `Get a compliant ${spec.displayName.toLowerCase()} in 60 seconds. Exact ${formatDimensions(
    spec
  )} (${formatPixels(spec)}), ${spec.bgColor.toUpperCase()} background, auto-cropped and compliance-checked. $4.99, refund if rejected.`;
  return {
    title,
    description,
    alternates: { canonical: `/photo/${spec.id}` },
    openGraph: {
      title,
      description,
      images: [`/photo/${spec.id}/opengraph-image`],
    },
  };
}

function faqFor(spec: ReturnType<typeof getSpec>) {
  if (!spec) return [];
  return [
    {
      q: `What size does a ${spec.displayName.toLowerCase()} need to be?`,
      a: `${formatDimensions(spec)} (${formatPixels(spec)} at ${spec.dpi}dpi), with a ${spec.bgColor.toUpperCase()} background.`,
    },
    {
      q: "Can I wear glasses?",
      a: spec.glassesAllowed
        ? "Yes, glasses are allowed as long as there's no glare and your eyes are clearly visible."
        : `No — glasses are not permitted for this photo unless you have a documented medical exemption.${
            spec.exemptionNotes ? ` ${spec.exemptionNotes}` : ""
          }`,
    },
    {
      q: "Can I smile?",
      a: spec.smileAllowed
        ? "A neutral expression or a natural smile with your mouth closed is accepted."
        : "No — a neutral expression with your mouth closed is required, both eyes open.",
    },
    {
      q: "How does VisaShot make sure my photo will be accepted?",
      a: "VisaShot auto-crops your photo to the exact official dimensions and head/eye position, replaces the background, and runs a compliance checklist covering head size, eye line, tilt, expression, glasses, lighting and contrast before you pay. If it's still rejected by the issuing authority, we refund you in full.",
    },
  ];
}

export default async function SpecPage({
  params,
}: {
  params: Promise<{ specId: string }>;
}) {
  const { specId } = await params;
  const spec = getSpec(specId);
  if (!spec) notFound();

  const related = relatedSpecs(spec);
  const faqs = faqFor(spec);

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

      <p className="font-mono text-xs uppercase tracking-widest text-accent mb-3">
        {spec.country} · {spec.docType}
        {spec.needsVerification ? " · specs under final review" : ""}
      </p>
      <h1 className="display text-4xl sm:text-5xl mb-4">
        {spec.displayName} Online — {formatDimensions(spec)}, App-Approved
      </h1>
      <p className="text-lg text-ink-soft leading-relaxed max-w-xl mb-8">
        Take a photo on your phone. VisaShot removes the background, crops to
        the exact {spec.country} government spec, and checks compliance — in
        60 seconds, for <span className="font-mono tnum">$4.99</span>.
        Rejected by the government? Full refund.
      </p>
      <Link
        href={`/create?spec=${spec.id}`}
        className="inline-flex items-center h-11 px-6 rounded-md bg-accent text-white font-medium hover:bg-accent-hover transition-colors"
      >
        Start your {spec.displayName.toLowerCase()}
      </Link>

      <section className="mt-12">
        <h2 className="font-mono text-xs uppercase tracking-widest text-ink-faint mb-4">
          Requirements
        </h2>
        <table className="w-full text-sm border-collapse">
          <tbody>
            <Row label="Physical size" value={formatDimensions(spec)} />
            <Row label="Pixel size" value={`${formatPixels(spec)} at ${spec.dpi}dpi`} />
            <Row label="Background" value={spec.bgColor.toUpperCase()} />
            <Row
              label="Head height"
              value={`${spec.headHeightPctMin}–${spec.headHeightPctMax}% of photo height`}
            />
            <Row
              label="Eye line"
              value={`${spec.eyeLinePctMin}–${spec.eyeLinePctMax}% from the bottom`}
            />
            <Row label="Glasses" value={spec.glassesAllowed ? "Allowed" : "Not allowed"} />
            <Row label="Expression" value={spec.smileAllowed ? "Neutral or slight smile" : "Neutral, mouth closed"} />
          </tbody>
        </table>
        <p className="mt-4 text-sm text-ink-faint leading-relaxed">{spec.notes}</p>
        {spec.exemptionNotes && (
          <p className="mt-3 text-sm text-ink-soft leading-relaxed rounded-md bg-paper border border-rule p-3">
            <strong className="text-ink">Exemptions:</strong> {spec.exemptionNotes}
          </p>
        )}
        <p className="mt-3 text-xs text-ink-faint">
          Source:{" "}
          <a href={spec.sourceUrl} className="underline underline-offset-2" rel="nofollow noopener">
            official government guidance
          </a>
          .
        </p>
      </section>

      <section className="mt-12">
        <h2 className="font-mono text-xs uppercase tracking-widest text-ink-faint mb-4">
          How it works
        </h2>
        <ol className="space-y-3 text-sm text-ink-soft list-decimal list-inside">
          <li>Take or upload a photo — live feedback keeps you centered and level.</li>
          <li>VisaShot removes the background and crops to {formatDimensions(spec)} automatically.</li>
          <li>A compliance checklist confirms head size, eye line, lighting and more.</li>
          <li>Pay $4.99 and download your photo, a 300dpi file, and a printable sheet.</li>
        </ol>
      </section>

      <section className="mt-12">
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

      {related.length > 0 && (
        <section className="mt-12">
          <h2 className="font-mono text-xs uppercase tracking-widest text-ink-faint mb-4">
            Related formats
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {related.map((r) => (
              <Link
                key={r.id}
                href={`/photo/${r.id}`}
                className="rounded-card border border-rule p-4 hover:border-rule-strong hover:shadow-card transition-all"
              >
                <p className="font-medium text-ink">{r.displayName}</p>
                <p className="font-mono text-xs text-ink-faint mt-1 tnum">{formatDimensions(r)}</p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <tr className="border-b border-rule">
      <td className="py-2.5 pr-4 text-ink-faint w-1/3">{label}</td>
      <td className="py-2.5 font-mono tnum text-ink">{value}</td>
    </tr>
  );
}
