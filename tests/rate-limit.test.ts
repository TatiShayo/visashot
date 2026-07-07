import { describe, it, expect, beforeEach } from "vitest";
import { rateLimit, clientIp, __resetRateLimitForTests } from "@/lib/rate-limit";

describe("rateLimit", () => {
  beforeEach(() => {
    __resetRateLimitForTests();
  });

  it("allows up to the limit, then blocks within the same window", () => {
    const key = "test-key-1";
    for (let i = 0; i < 5; i++) {
      const r = rateLimit(key, 5, 60_000);
      expect(r.ok).toBe(true);
    }
    const blocked = rateLimit(key, 5, 60_000);
    expect(blocked.ok).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it("tracks separate buckets per key independently", () => {
    const a = rateLimit("ip-a", 1, 60_000);
    const b = rateLimit("ip-b", 1, 60_000);
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    // Second hit on "ip-a" should now be blocked while "ip-b" is untouched.
    const aAgain = rateLimit("ip-a", 1, 60_000);
    expect(aAgain.ok).toBe(false);
  });

  it("resets the window after it elapses", async () => {
    const key = "test-key-window";
    const r1 = rateLimit(key, 1, 50); // 50ms window
    expect(r1.ok).toBe(true);
    const r2 = rateLimit(key, 1, 50);
    expect(r2.ok).toBe(false);
    await new Promise((resolve) => setTimeout(resolve, 80));
    const r3 = rateLimit(key, 1, 50);
    expect(r3.ok).toBe(true);
  });
});

describe("clientIp", () => {
  it("prefers the first x-forwarded-for entry", () => {
    const headers = new Headers({ "x-forwarded-for": "203.0.113.5, 70.41.3.18" });
    expect(clientIp(headers)).toBe("203.0.113.5");
  });

  it("falls back to x-real-ip, then 'unknown'", () => {
    expect(clientIp(new Headers({ "x-real-ip": "198.51.100.7" }))).toBe("198.51.100.7");
    expect(clientIp(new Headers())).toBe("unknown");
  });
});

describe("rate limiting applied to a real route (integration)", () => {
  it("the /api/process rate limiter rejects the 11th request within the window", async () => {
    // Import lazily so __resetRateLimitForTests() above doesn't race module init.
    const { POST } = await import("@/app/api/process/route");
    const { __resetOrderStoreForTests } = await import("@/lib/orders");
    __resetOrderStoreForTests();
    __resetRateLimitForTests();

    const makeReq = () => {
      const form = new FormData();
      form.set("specId", "does-not-exist"); // fails fast after rate-limit check
      return new Request("http://localhost/api/process", {
        method: "POST",
        headers: { "x-forwarded-for": "9.9.9.9" },
        body: form,
      });
    };

    let last: Response | undefined;
    for (let i = 0; i < 10; i++) {
      last = await POST(makeReq() as unknown as Parameters<typeof POST>[0]);
      expect(last.status).not.toBe(429);
    }
    const eleventh = await POST(makeReq() as unknown as Parameters<typeof POST>[0]);
    expect(eleventh.status).toBe(429);
  });
});
