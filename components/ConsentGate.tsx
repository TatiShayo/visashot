"use client";

/**
 * Biometric consent gate (BUILD_PROMPT #10 — non-negotiable): explicit
 * checkbox BEFORE any processing, linked privacy policy, "auto-deleted in 7
 * days" trust badge. Shown at upload; the same trust badge is re-shown at
 * preview and checkout per the spec.
 */

import Link from "next/link";
import { useState } from "react";

export function ConsentGate({ onAccept }: { onAccept: () => void }) {
  const [checked, setChecked] = useState(false);

  return (
    <div className="rounded-card border border-rule bg-paper p-5">
      <p className="text-sm text-ink-soft leading-relaxed">
        Your photo is processed only to generate your document photo. It is{" "}
        <strong className="text-ink">automatically deleted within 7 days</strong> and
        is never used for anything else, sold, or shared beyond the processors
        listed in our{" "}
        <Link href="/privacy" className="text-accent underline underline-offset-2">
          Privacy Policy
        </Link>
        .
      </p>
      <label className="mt-4 flex items-start gap-3 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
          className="mt-0.5 h-5 w-5 rounded border-rule-strong accent-[--color-accent]"
        />
        <span className="text-sm text-ink">
          I consent to my photo being processed to generate my document photo, and
          understand it will be automatically deleted within 7 days.
        </span>
      </label>
      <button
        disabled={!checked}
        onClick={onAccept}
        className="mt-4 inline-flex items-center h-11 px-6 rounded-md bg-accent text-white font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-accent-hover transition-colors"
      >
        Continue
      </button>
    </div>
  );
}

/** Small line-art trust badge — reused at upload, preview, and checkout. */
export function RetentionBadge() {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-rule px-3 py-1.5 text-xs text-ink-soft font-mono">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="3" y="10" width="18" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
        <path d="M7 10V7a5 5 0 0 1 10 0v3" stroke="currentColor" strokeWidth="1.6" />
      </svg>
      Auto-deleted in 7 days
    </div>
  );
}
