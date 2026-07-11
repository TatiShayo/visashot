import { createHmac } from "node:crypto";
import { test, expect } from "@playwright/test";
import { uploadAndProcess } from "./helpers";

/**
 * Security regression (BUILD_PROMPT: "the un-watermarked result NEVER leaves
 * the server before payment... verify in network tab as a test").
 * tests/security.test.ts already asserts this at the route-handler level;
 * this spec re-asserts it through a real browser + real HTTP, and additionally
 * proves the download endpoint's SECOND gate (server-side paid-status
 * re-check) independently of the signature gate.
 */
test("no un-watermarked image is reachable before payment", async ({ page, request }) => {
  const networkResponses: string[] = [];
  page.on("response", (res) => networkResponses.push(res.url()));

  const processResponse = await uploadAndProcess(page);
  const body = await processResponse.json();

  // 1. The /api/process response contains ONLY the watermarked preview
  //    (base64 data URI) + the report — no field ever names or links to the
  //    clean/processed storage object.
  expect(typeof body.preview).toBe("string");
  expect(body.preview.startsWith("data:image/png;base64,")).toBe(true);
  const allowedKeys = new Set([
    "orderId",
    "spec",
    "preview",
    "report",
    "purchasable",
    "backgroundMocked",
    "headHeightPct",
    "eyeLinePct",
  ]);
  for (const key of Object.keys(body)) {
    expect(allowedKeys.has(key), `unexpected field "${key}" in /api/process response`).toBe(true);
  }

  const orderId: string = body.orderId;
  expect(orderId).toBeTruthy();

  // 2. No network request made by the page during upload+processing ever hit
  //    a raw/clean asset path (defense in depth — no such route exists, but
  //    this guards against ever accidentally adding one).
  const leaked = networkResponses.filter((url) => /processed-[^/]+\.png/.test(url));
  expect(leaked, `leaked clean-asset URLs: ${leaked.join(", ")}`).toHaveLength(0);

  // 3. Gate 1 (signature): a garbage token is rejected outright.
  const badSig = await request.get(`/api/download/${orderId}?kind=photo&token=0.not-a-real-signature`);
  expect(badSig.status()).toBe(403);

  // 4. Gate 2 (payment re-check): even a VALID signature — computed the same
  //    way lib/sign.ts does, using the documented dev fallback secret that's
  //    active whenever DOWNLOAD_SIGNING_SECRET isn't set — is refused with
  //    402 while the order is still `pending` (unpaid). This is the gate that
  //    makes forwarded email links safe: the signature alone is not enough.
  const expiresAtMs = Date.now() + 60_000;
  const payload = `${orderId}.photo.${expiresAtMs}`;
  const sig = createHmac("sha256", "dev-only-signing-secret-do-not-use-in-prod")
    .update(payload)
    .digest("base64url");
  const validToken = `${expiresAtMs}.${sig}`;

  const prePaymentDownload = await request.get(
    `/api/download/${orderId}?kind=photo&token=${encodeURIComponent(validToken)}`
  );
  expect(prePaymentDownload.status()).toBe(402);
});
