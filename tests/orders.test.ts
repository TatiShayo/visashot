import { describe, it, expect, beforeEach } from "vitest";
import {
  getOrderStore,
  newOrderId,
  __resetOrderStoreForTests,
} from "@/lib/orders";

describe("Order Store & State Machine", () => {
  beforeEach(() => {
    __resetOrderStoreForTests();
  });

  it("newOrderId generates a unique non-empty string of suitable length", () => {
    const id1 = newOrderId();
    const id2 = newOrderId();
    expect(id1).toBeTruthy();
    expect(typeof id1).toBe("string");
    expect(id1.length).toBeGreaterThanOrEqual(16);
    expect(id1).not.toBe(id2);
  });

  it("creates a new order in pending status with defaults", async () => {
    const store = getOrderStore();
    const order = await store.create({
      specId: "us-passport",
      email: "buyer@example.com",
      amountCents: 499,
    });

    expect(order.id).toBeTruthy();
    expect(order.specId).toBe("us-passport");
    expect(order.email).toBe("buyer@example.com");
    expect(order.amountCents).toBe(499);
    expect(order.status).toBe("pending");
    expect(order.addonSpecIds).toEqual([]);
    expect(order.recoveryEmailSent).toBe(false);
    expect(order.expiryReminder6moSent).toBe(false);
    expect(order.expiryReminder1moSent).toBe(false);
    expect(order.createdAtMs).toBeGreaterThan(0);
    expect(order.paidAtMs).toBeNull();
  });

  it("retrieves an existing order by ID", async () => {
    const store = getOrderStore();
    const created = await store.create({
      specId: "schengen-visa",
      amountCents: 499,
    });

    const retrieved = await store.get(created.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.id).toBe(created.id);
    expect(retrieved?.specId).toBe("schengen-visa");
  });

  it("returns null when retrieving a nonexistent order ID", async () => {
    const store = getOrderStore();
    const result = await store.get("nonexistent-order-id-12345");
    expect(result).toBeNull();
  });

  it("updates order fields and persists changes", async () => {
    const store = getOrderStore();
    const created = await store.create({
      specId: "uk-passport",
      amountCents: 499,
    });

    const updated = await store.update(created.id, {
      status: "paid",
      paidAtMs: Date.now(),
      stripeSessionId: "sess_test_123",
      addonSpecIds: ["schengen-visa"],
    });

    expect(updated?.status).toBe("paid");
    expect(updated?.stripeSessionId).toBe("sess_test_123");
    expect(updated?.addonSpecIds).toEqual(["schengen-visa"]);

    const reloaded = await store.get(created.id);
    expect(reloaded?.status).toBe("paid");
    expect(reloaded?.stripeSessionId).toBe("sess_test_123");
  });

  it("returns null when updating a nonexistent order", async () => {
    const store = getOrderStore();
    const result = await store.update("nonexistent-id", { status: "paid" });
    expect(result).toBeNull();
  });

  it("finds order by Stripe checkout session ID", async () => {
    const store = getOrderStore();
    const created = await store.create({ specId: "canada-passport", amountCents: 499 });
    await store.update(created.id, { stripeSessionId: "cs_test_unique_999" });

    const found = await store.findByStripeSession("cs_test_unique_999");
    expect(found).not.toBeNull();
    expect(found?.id).toBe(created.id);

    const notFound = await store.findByStripeSession("cs_test_does_not_exist");
    expect(notFound).toBeNull();
  });

  it("lists recent orders up to limit ordered by creation time", async () => {
    const store = getOrderStore();
    const o1 = await store.create({ specId: "us-passport", amountCents: 499 });
    await store.update(o1.id, { createdAtMs: 1000 });

    const o2 = await store.create({ specId: "uk-passport", amountCents: 499 });
    await store.update(o2.id, { createdAtMs: 2000 });

    const o3 = await store.create({ specId: "schengen-visa", amountCents: 499 });
    await store.update(o3.id, { createdAtMs: 3000 });

    const recent = await store.listRecent(2);
    expect(recent.length).toBe(2);
    expect(recent[0].id).toBe(o3.id);
    expect(recent[1].id).toBe(o2.id);
  });

  it("lists abandoned orders older than threshold with email and not already sent", async () => {
    const store = getOrderStore();
    const now = Date.now();
    const fiveHoursAgo = now - 5 * 60 * 60 * 1000;
    const oneHourAgo = now - 1 * 60 * 60 * 1000;

    // 1. Abandoned order (> 4h, has email, pending, recovery not sent) -> match
    const a1 = await store.create({ specId: "us-passport", email: "user1@example.com", amountCents: 499 });
    await store.update(a1.id, { createdAtMs: fiveHoursAgo });

    // 2. Recent order (< 4h) -> should not match
    const a2 = await store.create({ specId: "us-passport", email: "user2@example.com", amountCents: 499 });
    await store.update(a2.id, { createdAtMs: oneHourAgo });

    // 3. Old order but already paid -> should not match
    const a3 = await store.create({ specId: "us-passport", email: "user3@example.com", amountCents: 499 });
    await store.update(a3.id, { createdAtMs: fiveHoursAgo, status: "paid" });

    // 4. Old order but recovery already sent -> should not match
    const a4 = await store.create({ specId: "us-passport", email: "user4@example.com", amountCents: 499 });
    await store.update(a4.id, { createdAtMs: fiveHoursAgo, recoveryEmailSent: true });

    // 5. Old order with no email -> should not match
    const a5 = await store.create({ specId: "us-passport", email: null, amountCents: 499 });
    await store.update(a5.id, { createdAtMs: fiveHoursAgo });

    const abandoned = await store.listAbandoned(4 * 60 * 60 * 1000, now);
    expect(abandoned.length).toBe(1);
    expect(abandoned[0].id).toBe(a1.id);
  });

  it("lists orders for expiry reminders in 6mo and 1mo windows correctly", async () => {
    const store = getOrderStore();
    const now = Date.now();
    const in5Months = new Date(now + 150 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const in20Days = new Date(now + 20 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const in2Years = new Date(now + 730 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    // Order 1: delivered, doc expires in 5 months (~150 days <= 183 days) -> matches 6mo stage
    const o1 = await store.create({ specId: "us-passport", email: "remind1@example.com", amountCents: 499 });
    await store.update(o1.id, { status: "delivered", docExpiryIso: in5Months });

    // Order 2: delivered, doc expires in 20 days (<= 30 days) -> matches 1mo stage
    const o2 = await store.create({ specId: "uk-passport", email: "remind2@example.com", amountCents: 499 });
    await store.update(o2.id, { status: "delivered", docExpiryIso: in20Days });

    // Order 3: doc expires in 2 years -> does not match either window yet
    const o3 = await store.create({ specId: "schengen-visa", email: "remind3@example.com", amountCents: 499 });
    await store.update(o3.id, { status: "delivered", docExpiryIso: in2Years });

    const due6mo = await store.listForExpiryReminders("6mo", now);
    const due1mo = await store.listForExpiryReminders("1mo", now);

    expect(due6mo.some((o) => o.id === o1.id)).toBe(true);
    expect(due6mo.some((o) => o.id === o3.id)).toBe(false);

    expect(due1mo.some((o) => o.id === o2.id)).toBe(true);
    expect(due1mo.some((o) => o.id === o3.id)).toBe(false);
  });
});
