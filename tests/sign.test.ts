import { describe, it, expect } from "vitest";
import {
  signDownloadToken,
  verifyDownloadToken,
  downloadUrl,
  DOWNLOAD_LINK_TTL_MS,
} from "@/lib/sign";

describe("signed download tokens", () => {
  const orderId = "ord_abc123";
  const future = Date.now() + 60_000;

  it("round-trips a valid token", () => {
    const token = signDownloadToken(orderId, "photo", future);
    expect(verifyDownloadToken(orderId, "photo", token)).toEqual({ ok: true });
  });

  it("rejects an expired token", () => {
    const token = signDownloadToken(orderId, "photo", Date.now() - 1000);
    expect(verifyDownloadToken(orderId, "photo", token)).toEqual({
      ok: false,
      reason: "expired",
    });
  });

  it("rejects a token bound to a different order", () => {
    const token = signDownloadToken(orderId, "photo", future);
    expect(verifyDownloadToken("ord_other", "photo", token).ok).toBe(false);
  });

  it("rejects a token bound to a different deliverable kind", () => {
    const token = signDownloadToken(orderId, "photo", future);
    expect(verifyDownloadToken(orderId, "hires", token).ok).toBe(false);
  });

  it("rejects tampered expiry (cannot extend lifetime)", () => {
    const token = signDownloadToken(orderId, "photo", future);
    const [, sig] = [token.slice(0, token.indexOf(".")), token.slice(token.indexOf(".") + 1)];
    const forged = `${future + 999_999}.${sig}`;
    expect(verifyDownloadToken(orderId, "photo", forged).ok).toBe(false);
  });

  it("rejects garbage tokens without throwing", () => {
    for (const bad of ["", ".", "abc", "123.", ".sig", "notanumber.sig"]) {
      expect(verifyDownloadToken(orderId, "photo", bad).ok).toBe(false);
    }
  });

  it("downloadUrl embeds a verifiable token with default 7-day TTL", () => {
    const url = new URL(downloadUrl("https://visashot.example", orderId, "sheet-a4"));
    expect(url.pathname).toBe(`/api/download/${orderId}`);
    expect(url.searchParams.get("kind")).toBe("sheet-a4");
    const token = url.searchParams.get("token")!;
    expect(verifyDownloadToken(orderId, "sheet-a4", token)).toEqual({ ok: true });
    const expiry = Number(token.slice(0, token.indexOf(".")));
    expect(expiry - Date.now()).toBeGreaterThan(DOWNLOAD_LINK_TTL_MS - 5000);
  });
});
