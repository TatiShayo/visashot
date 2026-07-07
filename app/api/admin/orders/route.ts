/**
 * GET /api/admin/orders — recent orders for the admin overview.
 * Allowlist-gated (ADMIN_TOKEN bearer). Fails closed if not configured.
 */

import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthorized } from "@/lib/admin-auth";
import { getOrderStore } from "@/lib/orders";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  if (!isAdminAuthorized(req.headers)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const orders = await getOrderStore().listRecent(200);
  return NextResponse.json({ orders });
}
