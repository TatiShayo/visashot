/**
 * Admin surface gate (PLAYBOOK 2.8): allowlist-gated, audit-logged.
 * Interim scheme until proper auth: a bearer token shared out-of-band
 * (`ADMIN_TOKEN`), checked on every admin API call. See PROJECT_STATE NEEDS
 * HUMAN for the upgrade path (real auth + `ADMIN_EMAILS` as the allowlist).
 */

import { createHash, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

/** Constant-time, length-independent token comparison (hash both sides first). */
export function tokensMatch(supplied: string, expected: string): boolean {
  const a = createHash("sha256").update(supplied).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export function isAdminAuthorized(headers: Headers): boolean {
  if (!env.adminToken) return false; // fail closed if not configured
  const auth = headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return false;
  return tokensMatch(auth.slice("Bearer ".length), env.adminToken);
}

export interface AuditLogEntry {
  atMs: number;
  action: string;
  orderId: string;
  detail?: string;
}

/** In-memory audit log (dev). Real deployments should persist this to Postgres. */
const auditLog: AuditLogEntry[] = [];

export function recordAudit(entry: Omit<AuditLogEntry, "atMs">) {
  auditLog.push({ ...entry, atMs: Date.now() });
}

export function getAuditLog(): AuditLogEntry[] {
  return [...auditLog].reverse();
}
