/**
 * GET /api/download/[orderId]?kind=...&token=...
 *
 * The ONLY path to a clean deliverable. Two independent gates:
 *   1. HMAC signature on the token (bound to orderId + kind + expiry).
 *   2. Server-side re-check that the order status is paid/delivered.
 *
 * Either gate failing → 403/404. This is what makes email-delivered links safe
 * to forward: they still re-check payment server-side on every hit.
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyDownloadToken, DELIVERABLE_KINDS, type DeliverableKind } from "@/lib/sign";
import { getOrderStore } from "@/lib/orders";
import { getStorage } from "@/lib/providers/storage";
import { getSpecOrThrow } from "@/data/photo-specs";
import { reportError } from "@/lib/monitoring";

export const runtime = "nodejs";

const KEY_FOR: Record<DeliverableKind, (id: string, specId: string) => string> = {
  photo: (id, s) => `${id}/processed-${s}.png`,
  hires: (id, s) => `${id}/hires-${s}.png`,
  "sheet-4x6": (id, s) => `${id}/sheet-4x6-${s}.pdf`,
  "sheet-a4": (id, s) => `${id}/sheet-a4-${s}.pdf`,
  instructions: (id) => `${id}/instructions.txt`,
};

const CONTENT_TYPE: Record<DeliverableKind, string> = {
  photo: "image/png",
  hires: "image/png",
  "sheet-4x6": "application/pdf",
  "sheet-a4": "application/pdf",
  instructions: "text/plain",
};

const EXTENSION_FOR: Record<DeliverableKind, string> = {
  photo: ".png",
  hires: ".png",
  "sheet-4x6": ".pdf",
  "sheet-a4": ".pdf",
  instructions: ".txt",
};

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await ctx.params;
  const url = new URL(req.url);
  const kind = url.searchParams.get("kind") as DeliverableKind | null;
  const token = url.searchParams.get("token");
  const specParam = url.searchParams.get("spec");

  if (!kind || !DELIVERABLE_KINDS.includes(kind) || !token) {
    return NextResponse.json({ error: "Invalid download request" }, { status: 400 });
  }

  // Gate 1: signature + expiry.
  let sig;
  try {
    sig = verifyDownloadToken(orderId, kind, token);
  } catch (e) {
    // Misconfiguration (e.g. DOWNLOAD_SIGNING_SECRET missing in real prod —
    // see lib/env.ts's requireSigningSecret) must fail closed, not leak a
    // 500 with a stack trace to an unauthenticated caller.
    reportError(e, { stage: "download-sign", orderId, kind });
    return NextResponse.json({ error: "Invalid link" }, { status: 403 });
  }
  if (!sig.ok) {
    return NextResponse.json(
      { error: sig.reason === "expired" ? "This link has expired" : "Invalid link" },
      { status: 403 }
    );
  }

  // Gate 2: payment status re-check (server-side, every time).
  const order = await getOrderStore().get(orderId);
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (order.status !== "paid" && order.status !== "delivered") {
    return NextResponse.json({ error: "Payment required" }, { status: 402 });
  }

  // Per-spec entitlement: `spec` must be one this order actually bought
  // (primary or an add-on). All specs on an order share its single payment, so
  // no separate token binding is needed — but an unpurchased spec is rejected.
  const entitledSpecIds = [order.specId, ...order.addonSpecIds];
  const requestedSpecId = specParam ?? order.specId;
  if (!entitledSpecIds.includes(requestedSpecId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const spec = getSpecOrThrow(requestedSpecId);
  const key = KEY_FOR[kind](orderId, spec.id);
  let bytes;
  try {
    bytes = await getStorage().get(key);
  } catch (e) {
    // A paid customer failing to fetch a file they already bought is a
    // high-value alert — same tier as a fulfillment failure.
    reportError(e, { stage: "download", orderId, kind });
    return NextResponse.json({ error: "File not ready" }, { status: 500 });
  }
  if (!bytes) return NextResponse.json({ error: "File not ready" }, { status: 404 });

  const ext = EXTENSION_FOR[kind] ?? "";
  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": CONTENT_TYPE[kind],
      "Content-Disposition": `attachment; filename="visashot-${spec.id}-${kind}${ext}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
