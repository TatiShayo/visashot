/**
 * Client-side error reporting — browser counterpart to lib/monitoring.ts.
 *
 * Forwards to `@sentry/nextjs`'s browser SDK when it is installed and
 * initialized (it registers `window.Sentry` / a global once its client config
 * runs). Until then it degrades to a console-only no-op so the error-boundary
 * instrumentation still runs in dev. No PII is attached here.
 */

"use client";

type ClientContext = Record<string, string | number | boolean | null>;

interface SentryBrowserLike {
  captureException(error: unknown, hint?: { extra?: ClientContext }): void;
}

function resolveSentry(): SentryBrowserLike | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { Sentry?: SentryBrowserLike };
  const candidate = w.Sentry;
  if (candidate && typeof candidate.captureException === "function") {
    return candidate;
  }
  return null;
}

export function reportClientError(error: unknown, context?: ClientContext): void {
  const sentry = resolveSentry();
  if (sentry) {
    try {
      sentry.captureException(error, context ? { extra: context } : undefined);
      return;
    } catch {
      /* fall through to console */
    }
  }
  if (process.env.NODE_ENV !== "production") {
    const msg = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    console.error("[monitoring-client:mock] captureException", msg, context ?? {});
  }
}
