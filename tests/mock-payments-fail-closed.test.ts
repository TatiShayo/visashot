import { describe, it, expect, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * SECURITY REGRESSION: the mock payment provider verifies nothing (it trusts
 * the JSON body). Its kill guards used to gate on VERCEL_ENV === "production",
 * so any production host that is not Vercel — a self-hosted build, a Docker
 * deploy — kept mock payments live: POST any orderId to /api/mock-pay or the
 * Stripe webhook route and the order is marked paid and fulfilled. Free
 * downloads for everyone. The guard must gate on NODE_ENV, with only the
 * Playwright e2e production build opting in explicitly.
 */
const ORIGINAL = {
  NODE_ENV: process.env.NODE_ENV,
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  E2E_ALLOW_MOCK_PAYMENTS: process.env.E2E_ALLOW_MOCK_PAYMENTS,
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  for (const [k, v] of Object.entries(ORIGINAL)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

async function loadMockPay() {
  return (await import("@/app/api/mock-pay/route")).POST;
}

async function loadStripeWebhook() {
  return (await import("@/app/api/webhook/stripe/route")).POST;
}

describe("mock payment guards — fail closed in production", () => {
  it("/api/mock-pay: 403 on a production host without the e2e opt-in", async () => {
    vi.stubEnv("NODE_ENV", "production");
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.E2E_ALLOW_MOCK_PAYMENTS;
    vi.resetModules();

    const POST = await loadMockPay();
    const res = await POST(
      new NextRequest("http://localhost:3000/api/mock-pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: "order-x" }),
      })
    );
    expect(res.status).toBe(403);
  });

  it("/api/mock-pay: proceeds only with the explicit e2e opt-in", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("E2E_ALLOW_MOCK_PAYMENTS", "1");
    delete process.env.STRIPE_SECRET_KEY;
    vi.resetModules();

    const POST = await loadMockPay();
    const res = await POST(
      new NextRequest("http://localhost:3000/api/mock-pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: "unknown-order" }),
      })
    );
    // Past the guard: the order does not exist, so 404 (not 403).
    expect(res.status).toBe(404);
  });

  it("/api/webhook/stripe: 403 for the mock provider on a production host", async () => {
    vi.stubEnv("NODE_ENV", "production");
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.E2E_ALLOW_MOCK_PAYMENTS;
    vi.resetModules();

    const POST = await loadStripeWebhook();
    const res = await POST(
      new NextRequest("http://localhost:3000/api/webhook/stripe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: "order-x" }),
      })
    );
    expect(res.status).toBe(403);
  });

  it("/api/webhook/stripe: mock provider still works outside production", async () => {
    vi.stubEnv("NODE_ENV", "test");
    delete process.env.STRIPE_SECRET_KEY;
    vi.resetModules();

    const POST = await loadStripeWebhook();
    const res = await POST(
      new NextRequest("http://localhost:3000/api/webhook/stripe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: "unknown-order" }),
      })
    );
    // Past the guard: unknown order -> 404 (not 403).
    expect(res.status).toBe(404);
  });
});
