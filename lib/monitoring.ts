/**
 * Error monitoring behind a typed interface — same env-gated mock pattern as
 * every other provider (bg-removal, payments, email, storage, turnstile).
 *
 * Real impl: Sentry (`@sentry/nextjs`). It is NOT installed here because it is a
 * heavy new dependency that needs human sign-off (see PROJECT_STATE "NEEDS
 * HUMAN" + the "justify any new dependency" discipline). Until it is installed
 * AND `SENTRY_DSN` is set, this degrades to a console-only no-op so the
 * instrumentation code path (captureException at every pipeline/payment failure)
 * still runs and is testable in dev.
 *
 * Wiring for real once approved is intentionally tiny:
 *   1. `npm install @sentry/nextjs`
 *   2. add the generated `sentry.*.config.ts` (or `instrumentation.ts`) files
 *   3. set `SENTRY_DSN` — this module then forwards to the loaded SDK.
 *
 * We resolve the SDK lazily and defensively (optional dynamic access) so that
 * the absence of the package can never break the build or a request.
 */

import { env } from "@/lib/env";

export type MonitoringContext = Record<string, string | number | boolean | null>;

export interface MonitoringProvider {
  /** Report an unexpected error with optional tags/extra context. */
  captureException(error: unknown, context?: MonitoringContext): void;
  /** Report a noteworthy non-error condition (e.g. degraded mock in prod). */
  captureMessage(message: string, context?: MonitoringContext): void;
  readonly mocked: boolean;
}

/**
 * Console-only fallback. Deliberately terse in production (no PII, no stack to
 * the client — this is server-side logging only) and never throws.
 */
class NoopMonitoringProvider implements MonitoringProvider {
  readonly mocked = true;

  captureException(error: unknown, context?: MonitoringContext): void {
    // Server logs only — client responses stay generic (PLAYBOOK 2.4).
    const msg = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    console.error("[monitoring:mock] captureException", msg, context ?? {});
  }

  captureMessage(message: string, context?: MonitoringContext): void {
    console.warn("[monitoring:mock] captureMessage", message, context ?? {});
  }
}

/**
 * Forwards to `@sentry/nextjs` when the package is installed and a DSN is set.
 * The SDK is accessed through an untyped optional require so this file compiles
 * and runs whether or not the dependency exists.
 */
interface SentryLike {
  captureException(error: unknown, hint?: { extra?: MonitoringContext }): void;
  captureMessage(
    message: string,
    hint?: { level?: string; extra?: MonitoringContext }
  ): void;
}

class SentryMonitoringProvider implements MonitoringProvider {
  readonly mocked = false;
  constructor(private readonly sentry: SentryLike) {}

  captureException(error: unknown, context?: MonitoringContext): void {
    try {
      this.sentry.captureException(error, context ? { extra: context } : undefined);
    } catch {
      // Monitoring must never take down the request path.
      const msg = error instanceof Error ? error.message : String(error);
      console.error("[monitoring] Sentry capture failed for:", msg);
    }
  }

  captureMessage(message: string, context?: MonitoringContext): void {
    try {
      this.sentry.captureMessage(
        message,
        context ? { level: "warning", extra: context } : { level: "warning" }
      );
    } catch {
      console.warn("[monitoring] Sentry message failed:", message);
    }
  }
}

/**
 * Best-effort, synchronous resolution of an already-initialized `@sentry/nextjs`
 * instance. We do NOT dynamically import here (that would be async and could
 * initialize the SDK from the wrong runtime); instead we read from the global
 * that the SDK's own instrumentation sets up once installed + configured. When
 * the package is absent this returns null and we fall back to the no-op.
 */
function resolveSentry(): SentryLike | null {
  if (!env.sentryDsn) return null;
  const g = globalThis as unknown as { __SENTRY__?: unknown; Sentry?: SentryLike };
  // `@sentry/nextjs` exposes captureException/captureMessage on a global once
  // its config module has run. If it isn't there, we haven't been wired yet.
  const candidate = g.Sentry;
  if (
    candidate &&
    typeof candidate.captureException === "function" &&
    typeof candidate.captureMessage === "function"
  ) {
    return candidate;
  }
  return null;
}

let cached: MonitoringProvider | null = null;

export function getMonitoring(): MonitoringProvider {
  if (cached) return cached;
  const sentry = resolveSentry();
  cached = sentry ? new SentryMonitoringProvider(sentry) : new NoopMonitoringProvider();
  return cached;
}

/** True when no real error monitor is active (no Sentry SDK or no DSN). */
export function monitoringIsMocked(): boolean {
  return getMonitoring().mocked;
}

/**
 * Convenience one-liner used across API routes. Swallows nothing at the call
 * site — always returns after recording, so callers keep their own control flow.
 */
export function reportError(error: unknown, context?: MonitoringContext): void {
  getMonitoring().captureException(error, context);
}

/** Test-only: reset the cached provider between test files. */
export function __resetMonitoringForTests(): void {
  cached = null;
}
