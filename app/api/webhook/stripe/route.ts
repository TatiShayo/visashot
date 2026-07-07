/**
 * POST /api/webhook/stripe — Stripe (or mock) payment confirmation.
 *
 * Verifies the signature, then marks the order paid and fulfills it. Idempotent:
 * re-delivery of the same event is a no-op past the first fulfillment.
 */

import { NextRequest, NextResponse } from "next/server";
import { getPaymentProvider } from "@/lib/providers/payments";
import { getOrderStore } from "@/lib/orders";
import { fulfillOrder } from "@/lib/fulfillment";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const raw = await req.text();
  const signature = req.headers.get("stripe-signature");

  let event;
  try {
    event = await getPaymentProvider().parseWebhook(raw, signature);
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
    await fulfillOrder(order.id);
  }

  return NextResponse.json({ received: true });
}
