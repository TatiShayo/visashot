"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { PhotoSpec } from "@/data/photo-specs";
import { formatDimensions } from "@/data/photo-specs";
import { BASE_PRICE_CENTS, ADDON_SPEC_CENTS, COMPLIANCE_PLUS_CENTS, formatUsd } from "@/lib/pricing";
import { RetentionBadge } from "@/components/ConsentGate";
import { track } from "@/lib/analytics";

export function CheckoutClient({
  orderId,
  spec,
  addons,
}: {
  orderId: string;
  spec: PhotoSpec;
  addons: PhotoSpec[];
}) {
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);
  const [compliancePlus, setCompliancePlus] = useState(false);
  const [docExpiry, setDocExpiry] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const totalCents = useMemo(() => {
    return (
      BASE_PRICE_CENTS +
      selectedAddons.length * ADDON_SPEC_CENTS +
      (compliancePlus ? COMPLIANCE_PLUS_CENTS : 0)
    );
  }, [selectedAddons, compliancePlus]);

  function toggleAddon(id: string) {
    setSelectedAddons((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      if (!prev.includes(id)) track("addon_attached", { spec_id: spec.id, addon_spec_id: id });
      return next;
    });
  }

  async function pay() {
    if (!consent || !email) return;
    setSubmitting(true);
    setError(null);
    track("checkout_started", {
      spec_id: spec.id,
      addon_spec_ids: selectedAddons,
      bump_selected: compliancePlus,
    });
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          email,
          consent: true,
          addonSpecIds: selectedAddons,
          compliancePlus,
          docExpiryIso: docExpiry || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Could not start checkout.");
        setSubmitting(false);
        return;
      }
      router.push(json.url);
    } catch {
      setError("Network error — please try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl px-4 sm:px-6 py-10 sm:py-16">
      <h1 className="display text-3xl sm:text-4xl mb-6">Checkout</h1>

      {/* Receipt-styled order summary */}
      <div className="rounded-card border border-rule bg-paper p-5 font-mono text-sm">
        <p className="text-ink-faint uppercase tracking-widest text-xs mb-3">Order summary</p>
        <div className="flex justify-between py-1.5 border-b border-dashed border-rule-strong">
          <span>{spec.displayName}</span>
          <span className="tnum">{formatUsd(BASE_PRICE_CENTS)}</span>
        </div>
        {selectedAddons.map((id) => {
          const s = addons.find((a) => a.id === id);
          if (!s) return null;
          return (
            <div key={id} className="flex justify-between py-1.5 border-b border-dashed border-rule-strong">
              <span>+ {s.displayName}</span>
              <span className="tnum">{formatUsd(ADDON_SPEC_CENTS)}</span>
            </div>
          );
        })}
        {compliancePlus && (
          <div className="flex justify-between py-1.5 border-b border-dashed border-rule-strong">
            <span>+ Compliance+ (30-day reprocessing)</span>
            <span className="tnum">{formatUsd(COMPLIANCE_PLUS_CENTS)}</span>
          </div>
        )}
        <div className="flex justify-between pt-3 font-semibold text-ink">
          <span>Total</span>
          <span className="tnum">{formatUsd(totalCents)}</span>
        </div>
      </div>

      {addons.length > 0 && (
        <div className="mt-6">
          <p className="text-sm font-medium text-ink mb-2">
            Need this photo in another format? <span className="text-ink-faint font-normal">+{formatUsd(ADDON_SPEC_CENTS)} each</span>
          </p>
          <div className="space-y-2">
            {addons.map((a) => (
              <label
                key={a.id}
                className="flex items-center gap-3 rounded-md border border-rule px-3 py-2.5 cursor-pointer hover:border-rule-strong transition-colors"
              >
                <input
                  type="checkbox"
                  checked={selectedAddons.includes(a.id)}
                  onChange={() => toggleAddon(a.id)}
                  className="h-5 w-5 rounded border-rule-strong accent-[--color-accent]"
                />
                <span className="flex-1 text-sm text-ink">{a.displayName}</span>
                <span className="text-xs text-ink-faint font-mono tnum">{formatDimensions(a)}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6">
        <label className="flex items-center gap-3 rounded-md border border-rule px-3 py-2.5 cursor-pointer hover:border-rule-strong transition-colors">
          <input
            type="checkbox"
            checked={compliancePlus}
            onChange={(e) => setCompliancePlus(e.target.checked)}
            className="h-5 w-5 rounded border-rule-strong accent-[--color-accent]"
          />
          <span className="flex-1 text-sm text-ink">
            Compliance+ — manual-quality recheck &amp; free reprocessing for 30 days
          </span>
          <span className="text-xs text-ink-faint font-mono tnum">+{formatUsd(COMPLIANCE_PLUS_CENTS)}</span>
        </label>
      </div>

      <div className="mt-6 space-y-3">
        <label className="block text-sm font-medium text-ink">Email (for delivery)</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full h-11 px-3 rounded-md border border-rule-strong bg-canvas placeholder:text-ink-faint focus-visible:outline-2 focus-visible:outline-accent"
        />
        <label className="block text-sm font-medium text-ink">
          When does this document expire? <span className="text-ink-faint font-normal">(optional — we&apos;ll remind you before renewal)</span>
        </label>
        <input
          type="date"
          value={docExpiry}
          onChange={(e) => setDocExpiry(e.target.value)}
          className="w-full h-11 px-3 rounded-md border border-rule-strong bg-canvas focus-visible:outline-2 focus-visible:outline-accent"
        />
      </div>

      <label className="mt-6 flex items-start gap-3 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-0.5 h-5 w-5 rounded border-rule-strong accent-[--color-accent]"
        />
        <span className="text-sm text-ink">
          I consent to my photo being processed to generate my document photo(s), auto-deleted
          within 7 days.
        </span>
      </label>

      <div className="mt-6 flex items-center gap-4">
        <RetentionBadge />
        <span className="inline-flex items-center gap-2 rounded-full border border-rule px-3 py-1.5 text-xs text-ink-soft font-mono">
          Full refund if rejected
        </span>
      </div>

      {error && <p className="mt-4 text-sm text-fail">{error}</p>}

      <button
        onClick={pay}
        disabled={!consent || !email || submitting}
        className="mt-6 w-full h-12 rounded-md bg-accent text-white font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-accent-hover transition-colors"
      >
        {submitting ? "Starting checkout…" : `Pay ${formatUsd(totalCents)}`}
      </button>
    </div>
  );
}
