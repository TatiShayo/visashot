import { describe, it, expect, beforeEach } from "vitest";
import { POST as stripeWebhookRoute } from "@/app/api/webhook/stripe/route";
import { getOrderStore, __resetOrderStoreForTests } from "@/lib/orders";
import { getStorage } from "@/lib/providers/storage";
import { NextRequest } from "next/server";
import sharp from "sharp";

describe("Stripe Webhook Route (/api/webhook/stripe)", () => {
  beforeEach(() => {
    __resetOrderStoreForTests();
  });

  it("handles mock webhook event for an existing pending order and fulfills it", async () => {
    const store = getOrderStore();
    const storage = getStorage();

    const order = await store.create({
      specId: "us-passport",
      email: "webhook-buyer@example.com",
      amountCents: 499,
    });

    // Create a dummy processed asset in storage so fulfillment can succeed
    const dummyPhoto = await sharp({
      create: { width: 600, height: 600, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
    })
      .png()
      .toBuffer();

    await storage.put(`${order.id}/processed-us-passport.png`, dummyPhoto, "image/png");
    await store.update(order.id, { processedKey: `${order.id}/processed-us-passport.png` });

    const req = new NextRequest("http://localhost:3000/api/webhook/stripe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId: order.id,
        sessionId: `mock_sess_${order.id}`,
      }),
    });

    const res = await stripeWebhookRoute(req);
    expect(res.status).toBe(200);

    const updated = await store.get(order.id);
    expect(updated?.status).toBe("delivered");
    expect(updated?.paidAtMs).toBeGreaterThan(0);
    expect(updated?.printSheetKey).toBeTruthy();
  });

  it("is idempotent: repeated webhook delivery for the same order succeeds without error", async () => {
    const store = getOrderStore();
    const storage = getStorage();

    const order = await store.create({
      specId: "us-passport",
      email: "idempotent@example.com",
      amountCents: 499,
    });

    const dummyPhoto = await sharp({
      create: { width: 600, height: 600, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
    })
      .png()
      .toBuffer();

    await storage.put(`${order.id}/processed-us-passport.png`, dummyPhoto, "image/png");
    await store.update(order.id, { processedKey: `${order.id}/processed-us-passport.png` });

    const req1 = new NextRequest("http://localhost:3000/api/webhook/stripe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: order.id }),
    });
    const res1 = await stripeWebhookRoute(req1);
    expect(res1.status).toBe(200);

    const req2 = new NextRequest("http://localhost:3000/api/webhook/stripe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: order.id }),
    });
    const res2 = await stripeWebhookRoute(req2);
    expect(res2.status).toBe(200);
  });

  it("returns 404 for unknown order ID in webhook payload", async () => {
    const req = new NextRequest("http://localhost:3000/api/webhook/stripe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: "unknown-order-99999" }),
    });

    const res = await stripeWebhookRoute(req);
    expect(res.status).toBe(404);
  });
});
