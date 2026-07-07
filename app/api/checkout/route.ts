/**
 * POST /api/checkout — create a checkout session for an existing order.
 *
 * The client sends INTENT only (orderId, which add-ons, order bump, email,
 * consent). The amount is computed server-side from lib/pricing — never trust
 * a client-supplied total. Requires the biometric consent flag.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { env } from "@/lib/env";
import { getOrderStore } from "@/lib/orders";
import { getSpec } from "@/data/photo-specs";
import { computePrice } from "@/lib/pricing";
import { getPaymentProvider } from "@/lib/providers/payments";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

const bodySchema = z.object({
  orderId: z.string().min(8).max(64),
  email: z.string().email(),
  consent: z.literal(true), // biometric consent gate — must be explicitly true
  addonSpecIds: z.array(z.string()).max(6).default([]),
  compliancePlus: z.boolean().default(false),
  docExpiryIso: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const ip = clientIp(req.headers);
  const rl = rateLimit(`checkout:${ip}`, 20, 5 * 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  let body;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json(
      { error: "Consent is required and all fields must be valid." },
      { status: 400 }
    );
  }

  const store = getOrderStore();
  const order = await store.get(body.orderId);
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (order.status !== "pending") {
    return NextResponse.json({ error: "Order already processed" }, { status: 409 });
  }

  // Validate add-on spec ids exist (ignore unknowns rather than trust them).
  const validAddons = body.addonSpecIds.filter((id) => getSpec(id) && id !== order.specId);
  const price = computePrice({
    addonSpecCount: validAddons.length,
    compliancePlus: body.compliancePlus,
  });

  await store.update(order.id, {
    email: body.email,
    addonSpecIds: validAddons,
    amountCents: price.totalCents,
    docExpiryIso: body.docExpiryIso ?? null,
  });

  const provider = getPaymentProvider();
  const session = await provider.createCheckout({
    orderId: order.id,
    amountCents: price.totalCents,
    email: body.email,
    description: `VisaShot photo set (${1 + validAddons.length} format${
      validAddons.length ? "s" : ""
    })`,
    successUrl: `${env.appUrl}/order/${order.id}`,
    cancelUrl: `${env.appUrl}/create?spec=${order.specId}`,
  });

  await store.update(order.id, { stripeSessionId: session.sessionId });

  return NextResponse.json({
    url: session.url,
    mocked: session.mocked,
    breakdown: price,
  });
}
