/**
 * Tiny counting semaphore for the heavy processing path.
 *
 * /api/process runs sharp decodes + a paid Replicate call per request; without
 * a cap, a burst (or a bot that beat the rate limiter across IPs) can pile up
 * dozens of concurrent full-image pipelines and OOM the instance. The
 * semaphore bounds concurrent pipelines and bounds the WAITING queue too —
 * beyond that, fail fast with 503 rather than letting requests stack up.
 *
 * In-memory, per-instance (same posture as lib/rate-limit.ts — documented
 * there and in REVIEW_FINDINGS L2). On serverless each instance gets its own
 * budget, which is exactly what protects that instance's memory.
 */

export class Semaphore {
  private inUse = 0;
  private readonly waiters: Array<() => void> = [];

  constructor(
    private readonly maxConcurrent: number,
    private readonly maxQueue: number
  ) {}

  /** Snapshot for tests/observability. */
  get state(): { inUse: number; queued: number } {
    return { inUse: this.inUse, queued: this.waiters.length };
  }

  /**
   * Acquire a slot. Resolves with a release function, or `null` immediately
   * when both the slots and the waiting queue are full (caller should 503).
   * The release function is idempotent.
   */
  async acquire(): Promise<(() => void) | null> {
    if (this.inUse < this.maxConcurrent) {
      this.inUse += 1;
      return this.releaser();
    }
    if (this.waiters.length >= this.maxQueue) return null;

    await new Promise<void>((resolve) => this.waiters.push(resolve));
    this.inUse += 1;
    return this.releaser();
  }

  /** Run `fn` inside a slot; returns `null` without running it if saturated. */
  async run<T>(fn: () => Promise<T>): Promise<{ ok: true; value: T } | { ok: false }> {
    const release = await this.acquire();
    if (!release) return { ok: false };
    try {
      return { ok: true, value: await fn() };
    } finally {
      release();
    }
  }

  private releaser(): () => void {
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.inUse -= 1;
      const next = this.waiters.shift();
      if (next) next();
    };
  }
}

/** Global budget for full photo pipelines (process route + fulfillment re-crops). */
export const processingSemaphore = new Semaphore(4, 16);

/** Test hook: fresh instance so tests don't share global state. */
export function __newSemaphoreForTests(maxConcurrent: number, maxQueue: number): Semaphore {
  return new Semaphore(maxConcurrent, maxQueue);
}
