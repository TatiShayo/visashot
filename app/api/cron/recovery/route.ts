/**
 * POST/GET /api/cron/recovery — abandoned-order recovery.
 *
 * One recovery email per abandoned order (pending, has email, >4h old), gated
 * by RECOVERY_EMAILS_ENABLED so it can be disabled without a redeploy. Sends a
 * single-use discount code (RECOVERY_PROMO_CODE). Never more than one email.
 */

import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { getOrderStore } from "@/lib/orders";
import { getEmailProvider } from "@/lib/providers/email";
import { getSpecOrThrow } from "@/data/photo-specs";
import { reportError } from "@/lib/monitoring";

export const runtime = "nodejs";

const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;

function authorized(req: NextRequest): boolean {
  if (!env.cronSecret) return !env.isProd;
  return req.headers.get("authorization") === `Bearer ${env.cronSecret}`;
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!env.recoveryEmailsEnabled) {
    return NextResponse.json({ sent: 0, disabled: true });
  }

  const store = getOrderStore();
  const email = getEmailProvider();
  const abandoned = await store.listAbandoned(FOUR_HOURS_MS, Date.now());
  const code = env.recoveryPromoCode ?? "COMEBACK20";

  let sent = 0;
  for (const order of abandoned) {
    if (!order.email) continue;
    try {
      const spec = getSpecOrThrow(order.specId);
      const checkoutUrl = `${env.appUrl}/checkout/${order.id}`;
      await email.send({
        to: order.email,
        subject: `Your ${spec.displayName} is still waiting`,
        text: `Finish your ${spec.displayName} and take 20% off with code ${code}. ${checkoutUrl}`,
        html: `<p>Your <strong>${spec.displayName}</strong> is ready to download.</p><p>Use code <strong>${code}</strong> for 20% off. <a href="${checkoutUrl}">Finish now</a>.</p>`,
      });
      await store.update(order.id, { recoveryEmailSent: true });
      sent += 1;
    } catch (e) {
      // One order's send failure shouldn't sink the whole cron batch.
      reportError(e, { stage: "cron-recovery", orderId: order.id });
    }
  }
  return NextResponse.json({ sent });
}

export const GET = POST;
