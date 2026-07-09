"use client";

/**
 * Route-segment error boundary. Renders a designed, human error state (PLAYBOOK
 * 1.5 — never a raw error string) and reports the error to monitoring so it
 * reaches Sentry once wired. Recovery path: reset() re-renders the segment.
 */

import { useEffect } from "react";
import Link from "next/link";
import { reportClientError } from "@/lib/monitoring-client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportClientError(error, { digest: error.digest ?? null });
  }, [error]);

  return (
    <div className="mx-auto max-w-lg px-4 sm:px-6 py-20 text-center">
      <p className="font-mono text-xs uppercase tracking-widest text-fail mb-3">
        Something interrupted this step
      </p>
      <h1 className="display text-3xl sm:text-4xl mb-3">We hit a snag</h1>
      <p className="text-ink-soft mb-8 leading-relaxed">
        Your photo is safe and nothing was charged. This is on us — please try
        that step again, or head back and start fresh.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <button
          onClick={reset}
          className="h-11 px-6 rounded-md bg-accent text-white font-medium hover:bg-accent-hover transition-colors"
        >
          Try again
        </button>
        <Link
          href="/"
          className="h-11 px-6 rounded-md border border-rule-strong font-medium inline-flex items-center hover:border-ink-faint transition-colors"
        >
          Back to start
        </Link>
      </div>
      {error.digest && (
        <p className="mt-8 font-mono text-xs text-ink-faint">
          Reference: {error.digest}
        </p>
      )}
    </div>
  );
}
