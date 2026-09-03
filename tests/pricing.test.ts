import { describe, it, expect } from "vitest";
import {
  BASE_PRICE_CENTS,
  COMPLIANCE_PLUS_CENTS,
  computePrice,
  formatUsd,
  type OrderIntent,
} from "@/lib/pricing";

describe("Pricing logic & calculations", () => {
  it("computes base price correctly for core photo set only", () => {
    const intent: OrderIntent = {
      addonSpecCount: 0,
      compliancePlus: false,
    };
    const res = computePrice(intent);
    expect(res.baseCents).toBe(BASE_PRICE_CENTS);
    expect(res.addonSpecCents).toBe(0);
    expect(res.compliancePlusCents).toBe(0);
    expect(res.totalCents).toBe(499);
    expect(res.lines.length).toBe(1);
    expect(res.lines[0]).toEqual({ label: "Photo set", cents: 499 });
  });

  it("computes price with a single add-on format", () => {
    const intent: OrderIntent = {
      addonSpecCount: 1,
      compliancePlus: false,
    };
    const res = computePrice(intent);
    expect(res.baseCents).toBe(499);
    expect(res.addonSpecCents).toBe(299);
    expect(res.compliancePlusCents).toBe(0);
    expect(res.totalCents).toBe(499 + 299);
    expect(res.lines.length).toBe(2);
    expect(res.lines[1]).toEqual({ label: "1 extra format", cents: 299 });
  });

  it("computes price with multiple add-on formats (plural label)", () => {
    const intent: OrderIntent = {
      addonSpecCount: 3,
      compliancePlus: false,
    };
    const res = computePrice(intent);
    expect(res.baseCents).toBe(499);
    expect(res.addonSpecCents).toBe(299 * 3);
    expect(res.compliancePlusCents).toBe(0);
    expect(res.totalCents).toBe(499 + 299 * 3);
    expect(res.lines[1]).toEqual({ label: "3 extra formats", cents: 897 });
  });

  it("computes price with Compliance+ order bump", () => {
    const intent: OrderIntent = {
      addonSpecCount: 0,
      compliancePlus: true,
    };
    const res = computePrice(intent);
    expect(res.baseCents).toBe(499);
    expect(res.addonSpecCents).toBe(0);
    expect(res.compliancePlusCents).toBe(COMPLIANCE_PLUS_CENTS);
    expect(res.totalCents).toBe(499 + 199);
    expect(res.lines.length).toBe(2);
    expect(res.lines[1].cents).toBe(199);
  });

  it("computes total with both add-ons and Compliance+", () => {
    const intent: OrderIntent = {
      addonSpecCount: 2,
      compliancePlus: true,
    };
    const res = computePrice(intent);
    expect(res.totalCents).toBe(499 + 299 * 2 + 199);
    expect(res.lines.length).toBe(3);
  });

  it("clamps negative add-on count to zero", () => {
    const intent: OrderIntent = {
      addonSpecCount: -5,
      compliancePlus: false,
    };
    const res = computePrice(intent);
    expect(res.addonSpecCents).toBe(0);
    expect(res.totalCents).toBe(499);
  });

  it("floors fractional add-on count to integer", () => {
    const intent: OrderIntent = {
      addonSpecCount: 2.7,
      compliancePlus: false,
    };
    const res = computePrice(intent);
    expect(res.addonSpecCents).toBe(299 * 2);
    expect(res.totalCents).toBe(499 + 598);
  });
});

describe("formatUsd", () => {
  it("formats zero cents", () => {
    expect(formatUsd(0)).toBe("$0.00");
  });

  it("formats standard amounts", () => {
    expect(formatUsd(499)).toBe("$4.99");
    expect(formatUsd(299)).toBe("$2.99");
    expect(formatUsd(199)).toBe("$1.99");
    expect(formatUsd(1097)).toBe("$10.97");
    expect(formatUsd(10000)).toBe("$100.00");
  });
});
