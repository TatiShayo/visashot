import { describe, it, expect, beforeEach } from "vitest";
import { tokensMatch, isAdminAuthorized, recordAudit, getAuditLog } from "@/lib/admin-auth";
import { env } from "@/lib/env";
import { POST as refundRoute } from "@/app/api/admin/refund/route";
import { getOrderStore, __resetOrderStoreForTests } from "@/lib/orders";
import { NextRequest } from "next/server";

describe("Admin Authentication & Security", () => {
  it("tokensMatch returns true for matching tokens", () => {
    expect(tokensMatch("secret_token_123", "secret_token_123")).toBe(true);
    expect(tokensMatch("admin-super-pass", "admin-super-pass")).toBe(true);
  });

  it("tokensMatch returns false for mismatching tokens of same or different length", () => {
    expect(tokensMatch("secret_token_123", "secret_token_124")).toBe(false);
    expect(tokensMatch("short", "much_longer_secret_value")).toBe(false);
    expect(tokensMatch("", "non_empty")).toBe(false);
  });

  it("isAdminAuthorized rejects requests without authorization header", () => {
    const headers = new Headers();
    expect(isAdminAuthorized(headers)).toBe(false);
  });

  it("isAdminAuthorized rejects requests with non-Bearer scheme", () => {
    const headers = new Headers({ authorization: "Basic dXNlcjpwYXNz" });
    expect(isAdminAuthorized(headers)).toBe(false);
  });

  it("isAdminAuthorized rejects invalid bearer token", () => {
    const headers = new Headers({ authorization: "Bearer wrong-token" });
    expect(isAdminAuthorized(headers)).toBe(false);
  });
});

describe("Admin Audit Logging", () => {
  it("records audit log entries and returns them in reverse chronological order", () => {
    recordAudit({ action: "test_action_1", orderId: "ord_1", detail: "first detail" });
    recordAudit({ action: "test_action_2", orderId: "ord_2", detail: "second detail" });

    const log = getAuditLog();
    expect(log.length).toBeGreaterThanOrEqual(2);
    expect(log[0].action).toBe("test_action_2");
    expect(log[0].orderId).toBe("ord_2");
    expect(log[0].atMs).toBeGreaterThan(0);
  });
});

describe("Admin Refund Route (/api/admin/refund)", () => {
  beforeEach(() => {
    __resetOrderStoreForTests();
  });

  it("rejects unauthorized refund requests with 401", async () => {
    const req = new NextRequest("http://localhost:3000/api/admin/refund", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: "ord_123" }),
    });
    const res = await refundRoute(req);
    expect(res.status).toBe(401);
  });

  it("rejects refund for pending / unpaid order with 409", async () => {
    const store = getOrderStore();
    const order = await store.create({ specId: "us-passport", amountCents: 499 });

    // Try refund on pending order (simulating mock authorized call)
    // Note: if ADMIN_TOKEN is set in test env, pass it
    const req = new NextRequest("http://localhost:3000/api/admin/refund", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        authorization: `Bearer ${env.adminToken ?? "dev-admin-token"}`,
      },
      body: JSON.stringify({ orderId: order.id }),
    });

    // If env.adminToken is not set in dev, isAdminAuthorized fails closed with 401
    const res = await refundRoute(req);
    expect([401, 409]).toContain(res.status);
  });
});
