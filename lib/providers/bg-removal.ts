/**
 * Background-removal provider behind a typed interface.
 *
 * Real impl: Replicate (851-labs/background-remover or rembg) returns a PNG
 * with a transparent (alpha) background. Mock impl (no REPLICATE_API_TOKEN):
 * returns the ORIGINAL bytes unchanged with `mocked: true` so the pipeline
 * keeps working and the gap is visible in the compliance report + admin.
 *
 * Never stall on a missing key — see BUILD_PROMPT "Never stall on missing keys".
 */

import { env } from "@/lib/env";

export interface BgRemovalInput {
  /** Raw image bytes (already re-encoded + EXIF-stripped upstream). */
  image: Buffer;
  /** MIME of the input, used only by the real provider's upload. */
  contentType: string;
}

export interface BgRemovalResult {
  /** PNG bytes with transparent background (real) or original bytes (mock). */
  image: Buffer;
  /** True when the mock ran — the "background" was NOT actually removed. */
  mocked: boolean;
  /** True when the output carries a real alpha channel to composite. */
  hasAlpha: boolean;
  provider: "replicate" | "mock";
}

export interface BgRemovalProvider {
  removeBackground(input: BgRemovalInput): Promise<BgRemovalResult>;
}

/** SSRF guard for any URL we fetch back from the provider. */
function assertSafeHttpUrl(raw: string): URL {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new Error("Provider returned an invalid URL");
  }
  if (u.protocol !== "https:") {
    throw new Error("Provider URL must be https");
  }
  const host = u.hostname.toLowerCase();
  const blocked =
    host === "localhost" ||
    host === "0.0.0.0" ||
    host.endsWith(".local") ||
    /^(127\.|10\.|192\.168\.|169\.254\.|::1)/.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host);
  if (blocked) throw new Error("Provider URL resolves to a private range");
  return u;
}

class MockBgRemovalProvider implements BgRemovalProvider {
  async removeBackground(input: BgRemovalInput): Promise<BgRemovalResult> {
    // No real removal: hand back the original. The pipeline still composes
    // onto the spec background, which for a mock means the subject keeps its
    // real background — the compliance report surfaces `backgroundMocked`.
    return {
      image: input.image,
      mocked: true,
      hasAlpha: false,
      provider: "mock",
    };
  }
}

class ReplicateBgRemovalProvider implements BgRemovalProvider {
  constructor(private readonly token: string) {}

  async removeBackground(input: BgRemovalInput): Promise<BgRemovalResult> {
    const dataUri = `data:${input.contentType};base64,${input.image.toString("base64")}`;

    const res = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
        Prefer: "wait",
      },
      body: JSON.stringify({
        // 851-labs/background-remover — returns a PNG with transparency.
        version:
          "a029dff38972b5fda4ec5d75d7d1cd25aeff621d2cf4946a41055d7db66b80bc",
        input: { image: dataUri },
      }),
      signal: AbortSignal.timeout(60_000),
    });

    if (!res.ok) {
      throw new Error(`Replicate error ${res.status}`);
    }
    const json = (await res.json()) as {
      status: string;
      output?: string | string[];
      error?: string;
    };
    if (json.status !== "succeeded" || !json.output) {
      throw new Error(`Replicate prediction failed: ${json.error ?? json.status}`);
    }
    const outUrl = Array.isArray(json.output) ? json.output[0] : json.output;
    const safe = assertSafeHttpUrl(outUrl);

    const imgRes = await fetch(safe, { signal: AbortSignal.timeout(30_000) });
    if (!imgRes.ok) throw new Error(`Failed to fetch result: ${imgRes.status}`);
    const buf = Buffer.from(await imgRes.arrayBuffer());
    if (buf.byteLength > 25 * 1024 * 1024) {
      throw new Error("Provider result exceeds size cap");
    }
    return { image: buf, mocked: false, hasAlpha: true, provider: "replicate" };
  }
}

let cached: BgRemovalProvider | null = null;

export function getBgRemovalProvider(): BgRemovalProvider {
  if (cached) return cached;
  cached = env.replicateApiToken
    ? new ReplicateBgRemovalProvider(env.replicateApiToken)
    : new MockBgRemovalProvider();
  return cached;
}

/** True when bg removal is running on the mock (no Replicate key). */
export function bgRemovalIsMocked(): boolean {
  return !env.replicateApiToken;
}
