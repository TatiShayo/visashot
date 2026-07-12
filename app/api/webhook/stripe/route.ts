/**
 * POST /api/webhook/stripe — Stripe (or mock) payment confirmation.
 *
 * Verifies the signature, then marks the order paid and fulfills it. Idempotent:
 * re-delivery of the same event is a no-op past the first fulfillment.
 */

import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { getPaymentProvider } from "@/lib/providers/payments";
import { getOrderStore } from "@/lib/orders";
import { fulfillOrder } from "@/lib/fulfillment";
import { reportError } from "@/lib/monitoring";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const provider = getPaymentProvider();

  // The MOCK provider performs no signature verification (it trusts the JSON
  // body) — on a real production deployment that would let anyone mark any
  // order paid. Same kill guard as /api/mock-pay. (REVIEW_FINDINGS H1)
  if (provider.mocked && env.isRealProdDeployment) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 403 });
  }

  const raw = await req.text();
  const signature = req.headers.get("stripe-signature");

  let event;
  try {
    event = await provider.parseWebhook(raw, signature);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ received: true });
  }

  const store = getOrderStore();
  const order = event.orderId
    ? await store.get(event.orderId)
    : event.sessionId
      ? await store.findByStripeSession(event.sessionId)
      : null;

  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  // Idempotent: only advance a pending order.
  if (order.status === "pending") {
    await store.update(order.id, { status: "paid", paidAtMs: Date.now() });
    try {
      await fulfillOrder(order.id);
    } catch (e) {
      // A paid customer not getting their files is the highest-value alert.
      // Capture, then return non-2xx so Stripe retries (fulfillOrder is
      // idempotent, so a retry is safe).
      reportError(e, { stage: "fulfillment", orderId: order.id });
      return NextResponse.json({ error: "Fulfillment failed" }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}
