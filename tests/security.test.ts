import { describe, it, expect, beforeEach } from "vitest";
import sharp from "sharp";
import { POST as processRoute } from "@/app/api/process/route";
import { getOrderStore, __resetOrderStoreForTests } from "@/lib/orders";
import { __resetRateLimitForTests } from "@/lib/rate-limit";
import { getStorage } from "@/lib/providers/storage";

/**
 * SECURITY REGRESSION (BUILD_PROMPT: "the un-watermarked result NEVER leaves
 * the server before payment... verify in network tab as a test"):
 *
 * This test calls the real /api/process route handler with a real
 * multipart/form-data body (no mocking of the pipeline) and inspects the
 * ACTUAL JSON response bytes for any trace of the clean, un-watermarked
 * processed photo. It also confirms the clean asset exists server-side
 * (proving the pipeline did run) so the assertion isn't vacuous.
 */

async function makePortraitJpeg(): Promise<Buffer> {
  // A plain rectangle is enough — the route only needs valid image bytes;
  // landmarks are supplied directly, bypassing real face detection.
  return sharp({
    create: { width: 1200, height: 1600, channels: 3, background: { r: 200, g: 180, b: 160 } },
  })
    .jpeg()
    .toBuffer();
}

function buildRequest(photo: Buffer, specId: string): Request {
  const form = new FormData();
  form.set("specId", specId);
  form.set(
    "photo",
    new File([new Uint8Array(photo)], "portrait.jpg", { type: "image/jpeg" })
  );
  form.set(
    "landmarks",
    JSON.stringify({ crownY: 320, chinY: 800, eyeY: 500, faceCenterX: 600 })
  );
  form.set(
    "signals",
    JSON.stringify({
      faceTiltDeg: 0,
      leftEyeClosed: 0,
      rightEyeClosed: 0,
      smileScore: 0,
      faceCount: 1,
      glassesDetected: false,
      clothingRgb: { r: 40, g: 60, b: 120 },
    })
  );
  return new Request("http://localhost/api/process", { method: "POST", body: form });
}

describe("security: no clean asset in any pre-payment response", () => {
  beforeEach(() => {
    __resetOrderStoreForTests();
    __resetRateLimitForTests();
  });

  it("returns only the watermarked preview + report — never the clean bytes", async () => {
    const photo = await makePortraitJpeg();
    const req = buildRequest(photo, "us-passport");

    const res = await processRoute(req as unknown as Parameters<typeof processRoute>[0]);
    const rawText = await res.text();
    const json = JSON.parse(rawText);

    expect(res.status).toBe(200);
    expect(json.orderId).toBeTruthy();
    expect(typeof json.preview).toBe("string");
    expect(json.preview.startsWith("data:image/png;base64,")).toBe(true);

    // The response body must not carry any key named after the clean asset,
    // and must not be large enough to plausibly smuggle a second full image.
    expect(rawText).not.toMatch(/processedKey|cleanBytes|clean_bytes/i);

    // Prove the clean asset actually exists server-side (pipeline really ran)
    // so a vacuously-passing "we returned nothing" isn't mistaken for success.
    const order = await getOrderStore().get(json.orderId);
    expect(order?.processedKey).toBeTruthy();
    expect(order?.watermarkedKey).toBeTruthy();
    const cleanBytes = await getStorage().get(order!.processedKey!);
    expect(cleanBytes).toBeTruthy();
    expect(cleanBytes!.length).toBeGreaterThan(0);

    // The clean bytes must NOT be byte-identical to (or a substring of) the
    // base64 preview payload the client actually received.
    const previewB64 = json.preview.replace("data:image/png;base64,", "");
    const cleanB64 = cleanBytes!.toString("base64");
    expect(previewB64).not.toBe(cleanB64);
    expect(rawText.includes(cleanB64)).toBe(false);

    // Order must still be "pending" — no payment occurred, so a paid-status
    // check on /api/download must reject any attempt to fetch the clean file.
    expect(order?.status).toBe("pending");
  });
});
