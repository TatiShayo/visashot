/**
 * Per-IP rate limiting for expensive/public endpoints.
 *
 * In-memory fixed-window limiter — correct for a single instance. On serverless
 * (multi-instance) this is best-effort; production should back it with Upstash
 * Ratelimit or a Postgres counter (NEEDS HUMAN, see README). Kept behind this
 * function so swapping the backend is a one-file change.
 */

interface Bucket {
  count: number;
  resetAtMs: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  resetAtMs: number;
}

/**
 * @param key    stable caller id (usually the client IP)
 * @param limit  max requests per window
 * @param windowMs window length
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now >= b.resetAtMs) {
    const resetAtMs = now + windowMs;
    buckets.set(key, { count: 1, resetAtMs });
    return { ok: true, remaining: limit - 1, resetAtMs };
  }
  if (b.count >= limit) {
    return { ok: false, remaining: 0, resetAtMs: b.resetAtMs };
  }
  b.count += 1;
  return { ok: true, remaining: limit - b.count, resetAtMs: b.resetAtMs };
}

/** Best-effort client IP from proxy headers. */
export function clientIp(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return headers.get("x-real-ip") ?? "unknown";
}

/** Test-only. */
export function __resetRateLimitForTests() {
  buckets.clear();
}
