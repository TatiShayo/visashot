import { describe, it, expect } from "vitest";
import { PHOTO_SPECS, getSpec, relatedSpecs, upsellSpecs } from "@/data/photo-specs";

/**
 * Specs whose OFFICIAL digital aspect ratio differs from the official print
 * size (both are government-published). The print sheet re-crops from the
 * master for these; documented in each spec's notes.
 */
const OFFICIAL_ASPECT_DIVERGENCE = new Set(["china-visa", "new-zealand-passport"]);

describe("photo spec database", () => {
  it("has at least 40 specs", () => {
    expect(PHOTO_SPECS.length).toBeGreaterThanOrEqual(40);
  });

  it("covers every launch-required document", () => {
    const required = [
      "us-passport",
      "us-visa",
      "schengen-visa",
      "uk-passport",
      "canada-passport",
      "australia-passport",
      "india-passport",
      "india-oci",
      "china-visa",
      "japan-passport",
      "brazil-passport",
      "nigeria-passport",
      "kenya-passport",
      "south-africa-passport",
      "uae-visa",
      "saudi-visa",
      "saudi-iqama",
      "philippines-passport",
      "mexico-passport",
      "us-green-card-dv",
      "tsa-precheck",
      "us-cdl-state-id",
      "us-passport-baby",
      "uk-passport-baby",
      "schengen-visa-baby",
    ];
    for (const id of required) {
      expect(getSpec(id), `missing required spec: ${id}`).toBeDefined();
    }
  });

  it("has unique ids", () => {
    const ids = PHOTO_SPECS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every spec has sane field values", () => {
    for (const s of PHOTO_SPECS) {
      const ctx = `spec ${s.id}`;
      expect(s.id, ctx).toMatch(/^[a-z0-9-]+$/);
      expect(s.country.length, ctx).toBeGreaterThan(1);
      expect(s.countryCode, ctx).toMatch(/^[A-Z]{2}$/);
      expect(s.displayName.length, ctx).toBeGreaterThan(3);
      expect(s.widthMm, ctx).toBeGreaterThanOrEqual(20);
      expect(s.widthMm, ctx).toBeLessThanOrEqual(80);
      expect(s.heightMm, ctx).toBeGreaterThanOrEqual(20);
      expect(s.heightMm, ctx).toBeLessThanOrEqual(80);
      expect(s.widthPx, ctx).toBeGreaterThanOrEqual(300);
      expect(s.heightPx, ctx).toBeGreaterThanOrEqual(300);
      expect(s.dpi, ctx).toBeGreaterThanOrEqual(300);
      expect(s.bgColor, ctx).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(s.headHeightPctMin, ctx).toBeGreaterThan(20);
      expect(s.headHeightPctMax, ctx).toBeLessThanOrEqual(90);
      expect(s.headHeightPctMin, ctx).toBeLessThan(s.headHeightPctMax);
      expect(s.eyeLinePctMin, ctx).toBeLessThan(s.eyeLinePctMax);
      expect(s.eyeLinePctMin, ctx).toBeGreaterThan(20);
      expect(s.eyeLinePctMax, ctx).toBeLessThanOrEqual(90);
      expect(s.notes.length, ctx).toBeGreaterThan(40);
      expect(s.sourceUrl, ctx).toMatch(/^https?:\/\//);
    }
  });

  it("pixel aspect matches physical aspect (except official divergences)", () => {
    for (const s of PHOTO_SPECS) {
      if (OFFICIAL_ASPECT_DIVERGENCE.has(s.id)) continue;
      const pxAspect = s.widthPx / s.heightPx;
      const mmAspect = s.widthMm / s.heightMm;
      expect(
        Math.abs(pxAspect - mmAspect) / mmAspect,
        `aspect mismatch in ${s.id}: px ${pxAspect.toFixed(3)} vs mm ${mmAspect.toFixed(3)}`
      ).toBeLessThan(0.02);
    }
  });

  it("pixel dimensions are consistent with mm at the declared dpi (±3%)", () => {
    for (const s of PHOTO_SPECS) {
      if (OFFICIAL_ASPECT_DIVERGENCE.has(s.id)) continue;
      const expectedW = (s.widthMm / 25.4) * s.dpi;
      expect(
        Math.abs(s.widthPx - expectedW) / expectedW,
        `dpi/px mismatch in ${s.id}: ${s.widthPx}px vs expected ${expectedW.toFixed(0)}px`
      ).toBeLessThan(0.03);
    }
  });

  it("every relatedSpecId resolves to a real spec", () => {
    for (const s of PHOTO_SPECS) {
      for (const rid of s.relatedSpecIds ?? []) {
        expect(getSpec(rid), `broken relatedSpecId ${rid} in ${s.id}`).toBeDefined();
      }
    }
  });

  it("infant specs are flagged beta with exemption notes", () => {
    for (const s of PHOTO_SPECS.filter((x) => x.infant)) {
      expect(s.beta, `${s.id} infant spec should be beta`).toBe(true);
      expect(s.exemptionNotes, `${s.id} infant spec needs exemption notes`).toBeTruthy();
    }
  });

  it("relatedSpecs/upsellSpecs return resolvable, non-self specs", () => {
    for (const s of PHOTO_SPECS) {
      for (const r of relatedSpecs(s)) expect(r.id).not.toBe(s.id);
      for (const u of upsellSpecs(s)) {
        expect(u.id).not.toBe(s.id);
        expect(u.infant).toBeFalsy();
      }
      expect(upsellSpecs(s).length).toBeLessThanOrEqual(3);
    }
  });
});
