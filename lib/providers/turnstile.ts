/**
 * Cloudflare Turnstile verification behind a typed interface (BUILD_PROMPT
 * security model: "processing endpoint rate-limited per IP + invisible
 * Turnstile — Replicate costs money, bots will find it").
 *
 * Mock impl (no TURNSTILE_SECRET_KEY): always passes, so the pipeline keeps
 * working in dev without a Cloudflare account. Real impl calls Cloudflare's
 * siteverify endpoint server-side.
 */

import { env } from "@/lib/env";

export interface TurnstileProvider {
  verify(token: string | null, remoteIp: string): Promise<{ ok: boolean; mocked: boolean }>;
}

class MockTurnstileProvider implements TurnstileProvider {
  async verify(): Promise<{ ok: boolean; mocked: boolean }> {
    return { ok: true, mocked: true };
  }
}

class CloudflareTurnstileProvider implements TurnstileProvider {
  constructor(private readonly secretKey: string) {}

  async verify(token: string | null, remoteIp: string): Promise<{ ok: boolean; mocked: boolean }> {
    if (!token) return { ok: false, mocked: false };
    try {
      const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret: this.secretKey, response: token, remoteip: remoteIp }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) return { ok: false, mocked: false };
      const json = (await res.json()) as { success: boolean };
      return { ok: json.success === true, mocked: false };
    } catch {
      // Fail closed on network errors — an unverifiable request is treated as untrusted.
      return { ok: false, mocked: false };
    }
  }
}

let cached: TurnstileProvider | null = null;

export function getTurnstileProvider(): TurnstileProvider {
  if (cached) return cached;
  cached = env.turnstileSecretKey
    ? new CloudflareTurnstileProvider(env.turnstileSecretKey)
    : new MockTurnstileProvider();
  return cached;
}
