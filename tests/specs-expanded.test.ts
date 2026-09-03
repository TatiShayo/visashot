import { describe, it, expect } from "vitest";
import {
  PHOTO_SPECS,
  getSpecOrThrow,
  isValidSpecId,
  getSpecsByCountryCode,
  getSpecsByDocType,
  searchSpecs,
  calculatePixelDimensions,
  formatDimensions,
  formatPixels,
} from "@/data/photo-specs";
import { hexToRgb } from "@/lib/pipeline";

describe("Photo Specs Database - Expanded Tests", () => {
  it("isValidSpecId returns true for valid IDs and false for invalid", () => {
    expect(isValidSpecId("us-passport")).toBe(true);
    expect(isValidSpecId("schengen-visa")).toBe(true);
    expect(isValidSpecId("fake-spec-id")).toBe(false);
    expect(isValidSpecId("")).toBe(false);
  });

  it("getSpecOrThrow throws descriptive error for unknown spec ID", () => {
    expect(() => getSpecOrThrow("unknown-id-xyz")).toThrow("Unknown photo spec: unknown-id-xyz");
  });

  it("getSpecsByCountryCode filters specs accurately", () => {
    const usSpecs = getSpecsByCountryCode("US");
    expect(usSpecs.length).toBeGreaterThanOrEqual(4);
    expect(usSpecs.every((s) => s.countryCode === "US")).toBe(true);

    const gbSpecs = getSpecsByCountryCode("gb"); // case insensitive
    expect(gbSpecs.length).toBeGreaterThanOrEqual(3);
    expect(gbSpecs.every((s) => s.countryCode === "GB")).toBe(true);

    const empty = getSpecsByCountryCode("ZZ");
    expect(empty).toEqual([]);
  });

  it("getSpecsByDocType filters by passport, visa, residency, id, other", () => {
    const passports = getSpecsByDocType("passport");
    expect(passports.length).toBeGreaterThanOrEqual(15);
    expect(passports.every((s) => s.docType === "passport")).toBe(true);

    const visas = getSpecsByDocType("visa");
    expect(visas.length).toBeGreaterThanOrEqual(10);
    expect(visas.every((s) => s.docType === "visa")).toBe(true);

    const residencies = getSpecsByDocType("residency");
    expect(residencies.length).toBeGreaterThanOrEqual(2);
  });

  it("searchSpecs finds matching specs by title, country, docType, or ID", () => {
    const schengenResults = searchSpecs("schengen");
    expect(schengenResults.length).toBeGreaterThanOrEqual(1);
    expect(schengenResults.some((s) => s.id === "schengen-visa")).toBe(true);

    const infantResults = searchSpecs("baby");
    expect(infantResults.length).toBeGreaterThanOrEqual(2);

    const emptyQuery = searchSpecs("");
    expect(emptyQuery.length).toBe(PHOTO_SPECS.length);

    const noMatch = searchSpecs("nonexistentquery12345");
    expect(noMatch).toEqual([]);
  });

  it("calculatePixelDimensions computes exact dimensions based on mm and DPI", () => {
    // 2 x 2 inches = 50.8 mm (51 mm) @ 300 DPI
    const us = calculatePixelDimensions(51, 51, 300);
    expect(us.widthPx).toBe(602);
    expect(us.heightPx).toBe(602);

    // 35 x 45 mm @ 600 DPI
    const schengen = calculatePixelDimensions(35, 45, 600);
    expect(schengen.widthPx).toBe(827);
    expect(schengen.heightPx).toBe(1063);
  });

  it("formatDimensions and formatPixels output expected strings", () => {
    const us = getSpecOrThrow("us-passport");
    expect(formatDimensions(us)).toBe("51 × 51 mm");
    expect(formatPixels(us)).toBe("600 × 600 px");

    const schengen = getSpecOrThrow("schengen-visa");
    expect(formatDimensions(schengen)).toBe("35 × 45 mm");
    expect(formatPixels(schengen)).toBe("827 × 1063 px");
  });

  it("every spec in the database has a valid hex background color parseable by hexToRgb", () => {
    for (const spec of PHOTO_SPECS) {
      const rgb = hexToRgb(spec.bgColor);
      expect(rgb.r).toBeGreaterThanOrEqual(0);
      expect(rgb.r).toBeLessThanOrEqual(255);
      expect(rgb.g).toBeGreaterThanOrEqual(0);
      expect(rgb.g).toBeLessThanOrEqual(255);
      expect(rgb.b).toBeGreaterThanOrEqual(0);
      expect(rgb.b).toBeLessThanOrEqual(255);
    }
  });

  it("country compliance specifics: US, Schengen, UK, Canada, Australia, China", () => {
    const us = getSpecOrThrow("us-passport");
    expect(us.widthMm).toBe(51);
    expect(us.heightMm).toBe(51);
    expect(us.glassesAllowed).toBe(false);
    expect(us.smileAllowed).toBe(true);

    const schengen = getSpecOrThrow("schengen-visa");
    expect(schengen.widthMm).toBe(35);
    expect(schengen.heightMm).toBe(45);
    expect(schengen.glassesAllowed).toBe(false);
    expect(schengen.smileAllowed).toBe(false);

    const uk = getSpecOrThrow("uk-passport");
    expect(uk.widthMm).toBe(35);
    expect(uk.heightMm).toBe(45);
    expect(uk.glassesAllowed).toBe(false);
    expect(uk.smileAllowed).toBe(false);

    const canada = getSpecOrThrow("canada-passport");
    expect(canada.widthMm).toBe(50);
    expect(canada.heightMm).toBe(70);
    expect(canada.glassesAllowed).toBe(true);
    expect(canada.smileAllowed).toBe(false);

    const china = getSpecOrThrow("china-visa");
    expect(china.widthMm).toBe(33);
    expect(china.heightMm).toBe(48);
    expect(china.glassesAllowed).toBe(false);
    expect(china.smileAllowed).toBe(false);

    const australia = getSpecOrThrow("australia-passport");
    expect(australia.widthMm).toBe(35);
    expect(australia.heightMm).toBe(45);
    expect(australia.glassesAllowed).toBe(false);
  });
});
