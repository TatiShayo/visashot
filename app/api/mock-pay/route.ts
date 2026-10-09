/**
 * POST /api/mock-pay — DEV-ONLY payment confirmation for the mock provider.
 *
 * Refuses to run when a real Stripe key is configured, and refuses in
 * production regardless — the real flow uses Stripe Checkout + webhook.
 */

import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { getOrderStore } from "@/lib/orders";
import { fulfillOrder } from "@/lib/fulfillment";
import { reportError } from "@/lib/monitoring";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  // Fail closed in ANY production host (NODE_ENV === "production"), not just
  // Vercel: a self-hosted prod build used to keep mock payments live — anyone
  // could POST an orderId and get free fulfillment. The Playwright e2e suite
  // intentionally runs a production build with the mock provider, so it opts
  // in explicitly via E2E_ALLOW_MOCK_PAYMENTS (never set on a real deploy).
  if (env.stripeSecretKey || (env.isProd && !process.env.E2E_ALLOW_MOCK_PAYMENTS)) {
    return NextResponse.json({ error: "Mock payments are disabled" }, { status: 403 });
  }
  const { orderId } = (await req.json().catch(() => ({}))) as { orderId?: string };
  if (!orderId) return NextResponse.json({ error: "Missing orderId" }, { status: 400 });

  const store = getOrderStore();
  const order = await store.get(orderId);
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  if (order.status === "pending") {
    await store.update(order.id, { status: "paid", paidAtMs: Date.now() });
    try {
      await fulfillOrder(order.id);
    } catch (e) {
      reportError(e, { stage: "fulfillment", orderId: order.id, provider: "mock" });
      return NextResponse.json({ error: "Fulfillment failed" }, { status: 500 });
    }
  }
  return NextResponse.json({ ok: true, orderId });
}
