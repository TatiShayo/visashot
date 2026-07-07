import type { Metadata } from "next";
import { getSpec, listSpecs } from "@/data/photo-specs";
import { SpecPicker } from "@/components/SpecPicker";
import { CreateClient } from "./CreateClient";

export const metadata: Metadata = {
  title: "Create your photo",
};

export default async function CreatePage({
  searchParams,
}: {
  searchParams: Promise<{ spec?: string }>;
}) {
  const { spec: specId } = await searchParams;
  const spec = specId ? getSpec(specId) : undefined;

  if (!spec) {
    return (
      <div className="mx-auto max-w-2xl px-4 sm:px-6 py-10 sm:py-16">
        <h1 className="display text-3xl sm:text-4xl mb-2">Which photo do you need?</h1>
        <p className="text-ink-soft mb-6">
          Search by country or document type — we&apos;ll set up the exact spec.
        </p>
        <SpecPicker specs={listSpecs()} />
      </div>
    );
  }

  return <CreateClient spec={spec} />;
}
