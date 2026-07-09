import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  getMonitoring,
  monitoringIsMocked,
  reportError,
  __resetMonitoringForTests,
} from "@/lib/monitoring";

describe("monitoring provider", () => {
  beforeEach(() => {
    __resetMonitoringForTests();
    // No SENTRY_DSN + no global Sentry -> no-op provider.
    delete process.env.SENTRY_DSN;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    __resetMonitoringForTests();
  });

  it("falls back to the no-op provider without a DSN", () => {
    expect(monitoringIsMocked()).toBe(true);
    expect(getMonitoring().mocked).toBe(true);
  });

  it("captureException never throws and logs to console in the mock", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => reportError(new Error("boom"), { stage: "test" })).not.toThrow();
    expect(spy).toHaveBeenCalled();
  });

  it("handles non-Error values without throwing", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => reportError("a plain string")).not.toThrow();
    expect(() => reportError(undefined)).not.toThrow();
    expect(() => reportError({ weird: true })).not.toThrow();
  });

  it("forwards to a globalThis.Sentry when a DSN is set and the SDK is present", () => {
    process.env.SENTRY_DSN = "https://example@o0.ingest.sentry.io/0";
    __resetMonitoringForTests();
    const captureException = vi.fn();
    const captureMessage = vi.fn();
    (globalThis as unknown as { Sentry?: unknown }).Sentry = {
      captureException,
      captureMessage,
    };
    try {
      const m = getMonitoring();
      expect(m.mocked).toBe(false);
      const err = new Error("real");
      m.captureException(err, { stage: "pipeline" });
      expect(captureException).toHaveBeenCalledWith(err, { extra: { stage: "pipeline" } });
    } finally {
      delete (globalThis as unknown as { Sentry?: unknown }).Sentry;
    }
  });
});
