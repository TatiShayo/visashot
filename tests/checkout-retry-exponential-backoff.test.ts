import { describe, it, expect, vi } from "vitest";
import { withExponentialBackoff } from "../lib/retry";

describe("Retry With Exponential Backoff", () => {
  it("resolves immediately on first attempt without retrying", async () => {
    const fn = vi.fn().mockResolvedValue("success");
    const result = await withExponentialBackoff(fn, { maxRetries: 3 });

    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on transient failure and resolves when subsequent call succeeds", async () => {
    let callCount = 0;
    const fn = vi.fn(async () => {
      callCount++;
      if (callCount === 1) {
        throw new Error("Network timeout");
      }
      return "recovered";
    });

    const result = await withExponentialBackoff(fn, {
      maxRetries: 2,
      initialDelayMs: 10,
    });

    expect(result).toBe("recovered");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("throws error once max retries are exhausted", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("Persistent 503"));

    await expect(
      withExponentialBackoff(fn, {
        maxRetries: 2,
        initialDelayMs: 5,
      })
    ).rejects.toThrow("Persistent 503");

    expect(fn).toHaveBeenCalledTimes(3); // Initial + 2 retries
  });
});
