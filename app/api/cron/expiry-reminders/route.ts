/**
 * POST/GET /api/cron/expiry-reminders — the renewal loop (BUILD_PROMPT #16 /
 * PLAYBOOK 3.4): "a $4.99 customer today is a returning customer in 2-10
 * years." Sends a reminder at 6 months and again at 1 month before the
 * document expiry the customer optionally gave at checkout. Each stage fires
 * at most once per order (tracked on the order row).
 */

import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { tokensMatch } from "@/lib/admin-auth";
import { getOrderStore } from "@/lib/orders";
import { getEmailProvider } from "@/lib/providers/email";
import { getSpecOrThrow } from "@/data/photo-specs";
import { reportError } from "@/lib/monitoring";

export const runtime = "nodejs";

function authorized(req: NextRequest): boolean {
  if (!env.cronSecret) return !env.isProd;
  const auth = req.headers.get("authorization") ?? "";
  return auth.startsWith("Bearer ") && tokensMatch(auth.slice(7), env.cronSecret);
}

const STAGE_COPY: Record<"6mo" | "1mo", { subject: (name: string) => string; body: (name: string, url: string) => string }> = {
  "6mo": {
    subject: (name) => `Renewal reminder: your ${name} expires in about 6 months`,
    body: (name, url) =>
      `Your ${name} is due for renewal in about 6 months. When you're ready, we've kept your specs on file — start a fresh photo any time: ${url}`,
  },
  "1mo": {
    subject: (name) => `Time to renew — your ${name} expires within a month`,
    body: (name, url) =>
      `Your ${name} expires within about a month. Get a fresh, compliant photo in 60 seconds: ${url}`,
  },
};

export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const store = getOrderStore();
  const email = getEmailProvider();
  let sent = 0;

  for (const stage of ["6mo", "1mo"] as const) {
    const due = await store.listForExpiryReminders(stage, Date.now());
    for (const order of due) {
      if (!order.email) continue;
      try {
        const spec = getSpecOrThrow(order.specId);
        const copy = STAGE_COPY[stage];
        const url = `${env.appUrl}/create?spec=${spec.id}`;
        await email.send({
          to: order.email,
          subject: copy.subject(spec.displayName),
          text: copy.body(spec.displayName, url),
          html: `<p>${copy.body(spec.displayName, url)}</p>`,
        });
        await store.update(order.id, {
          [stage === "6mo" ? "expiryReminder6moSent" : "expiryReminder1moSent"]: true,
        });
        sent += 1;
      } catch (e) {
        // One order's send failure shouldn't sink the whole cron batch.
        reportError(e, { stage: "cron-expiry-reminders", orderId: order.id, reminderStage: stage });
      }
    }
  }

  return NextResponse.json({ sent });
}

export const GET = POST;
