/**
 * POST/GET /api/cron/purge — 7-day retention purge.
 *
 * Deletes storage objects older than the retention window. This is a COMPLIANCE
 * feature (biometric-adjacent data minimization), not just cost control — it is
 * covered by a test. Authenticated with CRON_SECRET (Vercel Cron / manual).
 */

import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { tokensMatch } from "@/lib/admin-auth";
import { getStorage } from "@/lib/providers/storage";
import { reportError } from "@/lib/monitoring";

export const runtime = "nodejs";

function authorized(req: NextRequest): boolean {
  // Fail closed: with no configured CRON_SECRET this route does not run — in
  // ANY environment. The previous fallback (`return !env.isProd`) left the
  // route unauthenticated on every non-production host, including dev
  // deployments exposed to the internet and any self-hosted build.
  if (!env.cronSecret) return false;
  const auth = req.headers.get("authorization") ?? "";
  return auth.startsWith("Bearer ") && tokensMatch(auth.slice(7), env.cronSecret);
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const storage = getStorage();
  try {
    const expired = await storage.listExpired(Date.now());
    let purged = 0;
    for (const key of expired) {
      await storage.remove(key);
      purged += 1;
    }
    return NextResponse.json({ purged });
  } catch (e) {
    // Silent purge failures mean biometric-adjacent data outlives its
    // retention window — a compliance-relevant alert, not just ops noise.
    reportError(e, { stage: "cron-purge" });
    return NextResponse.json({ error: "Purge failed" }, { status: 500 });
  }
}

export const GET = POST;
