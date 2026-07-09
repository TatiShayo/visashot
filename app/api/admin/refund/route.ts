/**
 * POST /api/admin/refund — one-click refund (PLAYBOOK 4.2: "refunds WILL
 * happen — make them one click"). Allowlist-gated + audit-logged.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAdminAuthorized, recordAudit } from "@/lib/admin-auth";
import { getOrderStore } from "@/lib/orders";
import { getPaymentProvider } from "@/lib/providers/payments";
import { reportError } from "@/lib/monitoring";

export const runtime = "nodejs";

const bodySchema = z.object({
  orderId: z.string().min(8).max(64),
  reason: z.string().max(500).default("government rejection guarantee"),
});

export async function POST(req: NextRequest) {
  if (!isAdminAuthorized(req.headers)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const store = getOrderStore();
  const order = await store.get(body.orderId);
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (order.status !== "paid" && order.status !== "delivered") {
    return NextResponse.json({ error: "Order is not in a refundable state" }, { status: 409 });
  }
  if (!order.stripeSessionId) {
    return NextResponse.json({ error: "No payment session on this order" }, { status: 409 });
  }

  let result;
  try {
    result = await getPaymentProvider().refund(order.stripeSessionId);
  } catch (e) {
    reportError(e, { stage: "admin-refund", orderId: order.id });
    return NextResponse.json({ error: "Refund failed at the payment provider" }, { status: 502 });
  }
  if (!result.ok) {
    reportError(new Error("Refund provider returned ok: false"), {
      stage: "admin-refund",
      orderId: order.id,
    });
    return NextResponse.json({ error: "Refund failed at the payment provider" }, { status: 502 });
  }

  await store.update(order.id, { status: "refunded" });
  recordAudit({ action: "refund", orderId: order.id, detail: body.reason });

  return NextResponse.json({ ok: true, refundId: result.refundId });
}
