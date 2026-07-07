"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { PhotoSpec } from "@/data/photo-specs";
import { formatDimensions } from "@/data/photo-specs";
import { track } from "@/lib/analytics";

export function SpecPicker({ specs }: { specs: PhotoSpec[] }) {
  const [q, setQ] = useState("");
  const router = useRouter();

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return specs.slice(0, 8);
    return specs
      .filter(
        (s) =>
          s.country.toLowerCase().includes(query) ||
          s.displayName.toLowerCase().includes(query) ||
          s.docType.toLowerCase().includes(query)
      )
      .slice(0, 8);
  }, [q, specs]);

  function pick(spec: PhotoSpec) {
    track("spec_selected", {
      spec_id: spec.id,
      country_code: spec.countryCode,
      doc_type: spec.docType,
      source: "picker",
    });
    router.push(`/create?spec=${spec.id}`);
  }

  return (
    <div className="rounded-card border border-rule shadow-card bg-canvas">
      <div className="p-4 border-b border-rule">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={'Search country or document (e.g. "Schengen visa")'}
          className="w-full h-11 px-3 rounded-md border border-rule-strong bg-paper text-ink placeholder:text-ink-faint focus-visible:outline-2 focus-visible:outline-accent"
          aria-label="Search photo formats"
        />
      </div>
      <ul className="divide-y divide-rule max-h-96 overflow-y-auto">
        {filtered.map((spec) => (
          <li key={spec.id}>
            <button
              onClick={() => pick(spec)}
              className="w-full text-left px-4 py-3 hover:bg-paper transition-colors flex items-center justify-between gap-4"
            >
              <span>
                <span className="block text-ink font-medium">{spec.displayName}</span>
                <span className="block text-sm text-ink-faint font-mono tnum">
                  {formatDimensions(spec)}
                </span>
              </span>
              <span className="text-accent text-sm font-medium shrink-0">Select →</span>
            </button>
          </li>
        ))}
        {filtered.length === 0 && (
          <li className="px-4 py-6 text-sm text-ink-faint">No formats match &ldquo;{q}&rdquo;.</li>
        )}
      </ul>
    </div>
  );
}
