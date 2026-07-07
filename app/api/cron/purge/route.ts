/**
 * POST/GET /api/cron/purge — 7-day retention purge.
 *
 * Deletes storage objects older than the retention window. This is a COMPLIANCE
 * feature (biometric-adjacent data minimization), not just cost control — it is
 * covered by a test. Authenticated with CRON_SECRET (Vercel Cron / manual).
 */

import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { getStorage } from "@/lib/providers/storage";

export const runtime = "nodejs";

function authorized(req: NextRequest): boolean {
  // In production CRON_SECRET is required. In dev (no secret) allow local runs.
  if (!env.cronSecret) return !env.isProd;
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${env.cronSecret}`;
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const storage = getStorage();
  const expired = await storage.listExpired(Date.now());
  let purged = 0;
  for (const key of expired) {
    await storage.remove(key);
    purged += 1;
  }
  return NextResponse.json({ purged });
}

export const GET = POST;
