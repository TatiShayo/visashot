import { describe, it, expect, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * SECURITY REGRESSION: the cron routes (purge is destructive — it deletes
 * biometric-adjacent storage past the compliance retention window) used to
 * fall back to `return !env.isProd` when CRON_SECRET was unset, i.e. they ran
 * unauthenticated on any non-production host. They must fail closed.
 */
const ORIGINAL_CRON_SECRET = process.env.CRON_SECRET;

afterEach(() => {
  vi.resetModules();
  if (ORIGINAL_CRON_SECRET === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = ORIGINAL_CRON_SECRET;
});

const ROUTES = [
  ["purge", "@/app/api/cron/purge/route"],
  ["recovery", "@/app/api/cron/recovery/route"],
  ["expiry-reminders", "@/app/api/cron/expiry-reminders/route"],
] as const;

describe("cron routes — fail-closed auth", () => {
  for (const [name, mod] of ROUTES) {
    it(`${name}: 401 without CRON_SECRET configured`, async () => {
      delete process.env.CRON_SECRET;
      const { POST } = await import(mod);
      const res = await POST(new NextRequest("http://localhost:3000/api/cron", { method: "POST" }));
      expect(res.status).toBe(401);
    });

    it(`${name}: 401 with a wrong bearer token`, async () => {
      process.env.CRON_SECRET = "unit-test-cron-secret";
      const { POST } = await import(mod);
      const res = await POST(
        new NextRequest("http://localhost:3000/api/cron", {
          method: "POST",
          headers: { authorization: "Bearer wrong-secret" },
        })
      );
      expect(res.status).toBe(401);
    });
  }
});
