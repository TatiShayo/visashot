/**
 * HMAC-signed, expiring tokens for download links. No JWT dependency —
 * node:crypto covers it (least-code ladder).
 *
 * Token binds: orderId + file kind + expiry. Verification additionally
 * re-checks the order's paid status server-side at download time.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { requireSigningSecret } from "./env";

export type DeliverableKind = "photo" | "hires" | "sheet-4x6" | "sheet-a4" | "instructions";

export const DELIVERABLE_KINDS: DeliverableKind[] = [
  "photo",
  "hires",
  "sheet-4x6",
  "sheet-a4",
  "instructions",
];

function hmac(payload: string): string {
  return createHmac("sha256", requireSigningSecret()).update(payload).digest("base64url");
}

export function signDownloadToken(
  orderId: string,
  kind: DeliverableKind,
  expiresAtMs: number
): string {
  const payload = `${orderId}.${kind}.${expiresAtMs}`;
  return `${expiresAtMs}.${hmac(payload)}`;
}

export function verifyDownloadToken(
  orderId: string,
  kind: DeliverableKind,
  token: string
): { ok: true } | { ok: false; reason: "expired" | "invalid" } {
  const dot = token.indexOf(".");
  if (dot <= 0) return { ok: false, reason: "invalid" };
  const expiresAtMs = Number(token.slice(0, dot));
  const sig = token.slice(dot + 1);
  if (!Number.isFinite(expiresAtMs)) return { ok: false, reason: "invalid" };

  const expected = hmac(`${orderId}.${kind}.${expiresAtMs}`);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: "invalid" };
  }
  if (Date.now() > expiresAtMs) return { ok: false, reason: "expired" };
  return { ok: true };
}

/** Default link lifetime: 7 days (matches the storage purge window). */
export const DOWNLOAD_LINK_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function downloadUrl(
  appUrl: string,
  orderId: string,
  kind: DeliverableKind,
  opts: { specId?: string; ttlMs?: number } = {}
): string {
  const ttlMs = opts.ttlMs ?? DOWNLOAD_LINK_TTL_MS;
  const expiresAtMs = Date.now() + ttlMs;
  const token = signDownloadToken(orderId, kind, expiresAtMs);
  // The token binds orderId+kind+expiry; `spec` selects which purchased format
  // to fetch and is validated server-side against the order's own spec set.
  const specQ = opts.specId ? `&spec=${encodeURIComponent(opts.specId)}` : "";
  return `${appUrl}/api/download/${orderId}?kind=${kind}&token=${encodeURIComponent(token)}${specQ}`;
}
