/**
 * Payments behind a typed interface.
 *
 * Real impl: Stripe Checkout (one-time), signature-verified idempotent
 * webhooks. Mock impl (no STRIPE_SECRET_KEY): returns a local /mock-pay URL
 * that flips the order to paid, so the whole purchase flow runs in dev.
 *
 * Amounts come from lib/pricing (server-side) — the client never sends money.
 */

import Stripe from "stripe";
import { env } from "@/lib/env";

export interface CheckoutInput {
  orderId: string;
  amountCents: number;
  email?: string | null;
  successUrl: string;
  cancelUrl: string;
  description: string;
}

export interface CheckoutSession {
  sessionId: string;
  url: string;
  mocked: boolean;
}

export interface WebhookEvent {
  type: string;
  sessionId: string | null;
  orderId: string | null;
}

export interface PaymentProvider {
  createCheckout(input: CheckoutInput): Promise<CheckoutSession>;
  /** Verify signature + parse. Throws on invalid signature. */
  parseWebhook(rawBody: string, signature: string | null): Promise<WebhookEvent>;
  /** One-click admin refund (PLAYBOOK 4.2 — refunds must be one click). */
  refund(sessionId: string): Promise<{ ok: boolean; refundId: string | null }>;
  readonly mocked: boolean;
}

class MockPaymentProvider implements PaymentProvider {
  readonly mocked = true;

  async createCheckout(input: CheckoutInput): Promise<CheckoutSession> {
    const sessionId = `mock_sess_${input.orderId}`;
    // The mock pay page (app/mock-pay) marks the order paid then redirects to
    // successUrl — mirrors the real Stripe redirect contract.
    const url = `/mock-pay?order=${encodeURIComponent(
      input.orderId
    )}&session=${encodeURIComponent(sessionId)}`;
    return { sessionId, url, mocked: true };
  }

  async parseWebhook(rawBody: string): Promise<WebhookEvent> {
    // In mock mode the "webhook" is the mock-pay confirmation posting JSON.
    const body = JSON.parse(rawBody) as { orderId?: string; sessionId?: string };
    return {
      type: "checkout.session.completed",
      sessionId: body.sessionId ?? null,
      orderId: body.orderId ?? null,
    };
  }

  async refund(): Promise<{ ok: boolean; refundId: string | null }> {
    return { ok: true, refundId: `mock_refund_${Date.now()}` };
  }
}

class StripePaymentProvider implements PaymentProvider {
  readonly mocked = false;
  private stripe: Stripe;

  constructor(secretKey: string, private webhookSecret: string | undefined) {
    this.stripe = new Stripe(secretKey, { apiVersion: "2025-01-27.acacia" as Stripe.LatestApiVersion });
  }

  async createCheckout(input: CheckoutInput): Promise<CheckoutSession> {
    const session = await this.stripe.checkout.sessions.create({
      mode: "payment",
      // Amount is server-computed; client never supplies it.
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: input.amountCents,
            product_data: { name: input.description },
          },
        },
      ],
      customer_email: input.email ?? undefined,
      client_reference_id: input.orderId,
      metadata: { orderId: input.orderId },
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      automatic_tax: { enabled: true },
    });
    if (!session.url) throw new Error("Stripe did not return a checkout URL");
    return { sessionId: session.id, url: session.url, mocked: false };
  }

  async parseWebhook(rawBody: string, signature: string | null): Promise<WebhookEvent> {
    if (!this.webhookSecret) throw new Error("Missing STRIPE_WEBHOOK_SECRET");
    if (!signature) throw new Error("Missing Stripe signature");
    const event = this.stripe.webhooks.constructEvent(
      rawBody,
      signature,
      this.webhookSecret
    );
    if (event.type === "checkout.session.completed") {
      const s = event.data.object as Stripe.Checkout.Session;
      return {
        type: event.type,
        sessionId: s.id,
        orderId: (s.metadata?.orderId as string) ?? s.client_reference_id ?? null,
      };
    }
    return { type: event.type, sessionId: null, orderId: null };
  }

  async refund(sessionId: string): Promise<{ ok: boolean; refundId: string | null }> {
    const session = await this.stripe.checkout.sessions.retrieve(sessionId);
    if (!session.payment_intent) return { ok: false, refundId: null };
    const paymentIntentId =
      typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent.id;
    const refund = await this.stripe.refunds.create({ payment_intent: paymentIntentId });
    return { ok: refund.status === "succeeded" || refund.status === "pending", refundId: refund.id };
  }
}

let cached: PaymentProvider | null = null;

export function getPaymentProvider(): PaymentProvider {
  if (cached) return cached;
  cached = env.stripeSecretKey
    ? new StripePaymentProvider(env.stripeSecretKey, env.stripeWebhookSecret)
    : new MockPaymentProvider();
  return cached;
}
