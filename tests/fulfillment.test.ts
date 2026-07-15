import { describe, it, expect, beforeEach } from "vitest";
import sharp from "sharp";
import { POST as processRoute } from "@/app/api/process/route";
import { GET as downloadRoute } from "@/app/api/download/[orderId]/route";
import { fulfillOrder, orderSpecIds } from "@/lib/fulfillment";
import { getOrderStore, __resetOrderStoreForTests } from "@/lib/orders";
import { __resetRateLimitForTests } from "@/lib/rate-limit";
import { getStorage } from "@/lib/providers/storage";
import { mockOutbox } from "@/lib/providers/email";
import { downloadUrl } from "@/lib/sign";
import { env } from "@/lib/env";

/**
 * REGRESSION for REVIEW_FINDINGS H2 — "paid add-on specs are charged but never
 * fulfilled". A customer buying a primary + add-on spec must receive
 * deliverables for BOTH, and the download route must serve an add-on spec's
 * files (it's paid for) while rejecting a spec the order never bought.
 */

const PRIMARY = "us-passport";
const ADDON = "us-visa";

async function makePortraitJpeg(): Promise<Buffer> {
  return sharp({
    create: { width: 1200, height: 1600, channels: 3, background: { r: 200, g: 180, b: 160 } },
  })
    .jpeg()
    .toBuffer();
}

function buildProcessRequest(photo: Buffer, specId: string): Request {
  const form = new FormData();
  form.set("specId", specId);
  form.set("photo", new File([new Uint8Array(photo)], "portrait.jpg", { type: "image/jpeg" }));
  form.set("landmarks", JSON.stringify({ crownY: 320, chinY: 800, eyeY: 500, faceCenterX: 600 }));
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

async function callDownload(orderId: string, kind: string, specId: string): Promise<Response> {
  const url = downloadUrl(env.appUrl, orderId, kind as never, { specId });
  const req = new Request(url, { method: "GET" });
  return downloadRoute(req as never, { params: Promise.resolve({ orderId }) });
}

/** Run /api/process, then attach an add-on spec (as /api/checkout would). */
async function makePaidOrderWithAddon(): Promise<string> {
  const photo = await makePortraitJpeg();
  const res = await processRoute(
    buildProcessRequest(photo, PRIMARY) as unknown as Parameters<typeof processRoute>[0]
  );
  const { orderId } = (await res.json()) as { orderId: string };

  const store = getOrderStore();
  await store.update(orderId, {
    email: "buyer@example.com",
    addonSpecIds: [ADDON],
    status: "paid",
    paidAtMs: Date.now(),
  });
  return orderId;
}

describe("fulfillment: per-spec deliverables (primary + add-ons)", () => {
  beforeEach(() => {
    __resetOrderStoreForTests();
    __resetRateLimitForTests();
    mockOutbox.length = 0;
  });

  it("orderSpecIds returns primary then de-duped add-ons", () => {
    const specIds = orderSpecIds({
      specId: PRIMARY,
      addonSpecIds: [ADDON, PRIMARY, ADDON],
    } as never);
    expect(specIds).toEqual([PRIMARY, ADDON]);
  });

  it("generates every deliverable for BOTH the primary and the add-on spec", async () => {
    const orderId = await makePaidOrderWithAddon();
    const order = await fulfillOrder(orderId);
    expect(order?.status).toBe("delivered");

    const storage = getStorage();
    for (const specId of [PRIMARY, ADDON]) {
      for (const key of [
        `${orderId}/processed-${specId}.png`,
        `${orderId}/hires-${specId}.png`,
        `${orderId}/sheet-a4-${specId}.pdf`,
      ]) {
        const bytes = await storage.get(key);
        expect(bytes, `missing ${key}`).toBeTruthy();
        expect(bytes!.length).toBeGreaterThan(0);
      }
    }
  });

  it("emails per-spec links covering both specs", async () => {
    const orderId = await makePaidOrderWithAddon();
    await fulfillOrder(orderId);
    expect(mockOutbox.length).toBe(1);
    const body = mockOutbox[0].text + mockOutbox[0].html;
    expect(body).toContain(`spec=${PRIMARY}`);
    expect(body).toContain(`spec=${ADDON}`);
  });

  it("is idempotent — a second fulfill does not resend the email", async () => {
    const orderId = await makePaidOrderWithAddon();
    await fulfillOrder(orderId);
    await fulfillOrder(orderId);
    expect(mockOutbox.length).toBe(1);
  });

  it("download route serves the paid add-on spec", async () => {
    const orderId = await makePaidOrderWithAddon();
    await fulfillOrder(orderId);
    const res = await callDownload(orderId, "photo", ADDON);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/png");
  });

  it("download route rejects a spec the order never bought (404)", async () => {
    const orderId = await makePaidOrderWithAddon();
    await fulfillOrder(orderId);
    const res = await callDownload(orderId, "photo", "schengen-visa");
    expect(res.status).toBe(404);
  });

  it("download route still enforces payment (402 before paid) for add-on spec", async () => {
    const photo = await makePortraitJpeg();
    const res = await processRoute(
      buildProcessRequest(photo, PRIMARY) as unknown as Parameters<typeof processRoute>[0]
    );
    const { orderId } = (await res.json()) as { orderId: string };
    await getOrderStore().update(orderId, { addonSpecIds: [ADDON] }); // still pending
    const dl = await callDownload(orderId, "photo", ADDON);
    expect(dl.status).toBe(402);
  });
});
