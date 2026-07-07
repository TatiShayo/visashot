import { describe, it, expect } from "vitest";
import {
  computeCropRect,
  landmarksFromNormalized,
  CropError,
  type FaceLandmarks,
} from "@/lib/crop";
import { getSpecOrThrow, PHOTO_SPECS } from "@/data/photo-specs";

const US = getSpecOrThrow("us-passport");
const SCHENGEN = getSpecOrThrow("schengen-visa");

/** A well-framed portrait: 3000x4000, head ~1200px tall, centered. */
const centered: FaceLandmarks = {
  crownY: 800,
  chinY: 2000,
  eyeY: 1250,
  faceCenterX: 1500,
};

const midpoint = (a: number, b: number) => (a + b) / 2;

describe("computeCropRect", () => {
  it("places head height at the midpoint of the spec range", () => {
    const { headHeightPct } = computeCropRect(centered, 3000, 4000, US);
    expect(headHeightPct).toBeCloseTo(
      midpoint(US.headHeightPctMin, US.headHeightPctMax),
      0
    );
  });

  it("places the eye line at the midpoint of the spec range (from bottom)", () => {
    const { eyeLinePct } = computeCropRect(centered, 3000, 4000, US);
    expect(eyeLinePct).toBeCloseTo(
      midpoint(US.eyeLinePctMin, US.eyeLinePctMax),
      0
    );
  });

  it("respects the spec aspect ratio", () => {
    for (const spec of [US, SCHENGEN]) {
      const { rect } = computeCropRect(centered, 3000, 4000, spec);
      expect(rect.width / rect.height).toBeCloseTo(
        spec.widthPx / spec.heightPx,
        2
      );
    }
  });

  it("centers the face horizontally", () => {
    const { rect } = computeCropRect(centered, 3000, 4000, US);
    // Integer pixel rects: an odd width puts the exact center on a half-pixel,
    // so the achievable centering error is <= 0.5px.
    expect(Math.abs(rect.left + rect.width / 2 - centered.faceCenterX)).toBeLessThanOrEqual(0.5);
  });

  it("produces in-range results for every spec in the database", () => {
    for (const spec of PHOTO_SPECS) {
      const { headHeightPct, eyeLinePct } = computeCropRect(
        centered,
        3000,
        4000,
        spec
      );
      expect(headHeightPct).toBeGreaterThanOrEqual(spec.headHeightPctMin - 1);
      expect(headHeightPct).toBeLessThanOrEqual(spec.headHeightPctMax + 1);
      expect(eyeLinePct).toBeGreaterThanOrEqual(spec.eyeLinePctMin - 1);
      expect(eyeLinePct).toBeLessThanOrEqual(spec.eyeLinePctMax + 1);
    }
  });

  // ── Edge cases ────────────────────────────────────────────────────────────

  it("very tall skinny photo: crop may extend past sides and warns", () => {
    // 500px wide, 4000 tall, face fills the width.
    const lm: FaceLandmarks = {
      crownY: 500,
      chinY: 1400,
      eyeY: 840,
      faceCenterX: 250,
    };
    const res = computeCropRect(lm, 500, 4000, US);
    // Crop must still honor geometry even though it overflows the source.
    expect(res.rect.width / res.rect.height).toBeCloseTo(1, 2);
    expect(res.rect.left).toBeLessThan(0);
    expect(res.warnings.some((w) => /edge|center/i.test(w))).toBe(true);
  });

  it("very wide photo: geometry still lands mid-range", () => {
    const lm: FaceLandmarks = {
      crownY: 200,
      chinY: 700,
      eyeY: 390,
      faceCenterX: 4000,
    };
    const res = computeCropRect(lm, 8000, 1000, SCHENGEN);
    expect(res.headHeightPct).toBeCloseTo(
      midpoint(SCHENGEN.headHeightPctMin, SCHENGEN.headHeightPctMax),
      0
    );
    expect(res.rect.width / res.rect.height).toBeCloseTo(
      SCHENGEN.widthPx / SCHENGEN.heightPx,
      2
    );
  });

  it("off-center face near the left edge: warns but stays centered on face", () => {
    const lm: FaceLandmarks = {
      crownY: 800,
      chinY: 2000,
      eyeY: 1250,
      faceCenterX: 150,
    };
    const res = computeCropRect(lm, 3000, 4000, US);
    expect(res.rect.left).toBeLessThan(0);
    expect(Math.abs(res.rect.left + res.rect.width / 2 - 150)).toBeLessThanOrEqual(0.5);
    expect(res.warnings.length).toBeGreaterThan(0);
  });

  it("face near the bottom edge: warns about missing shoulders", () => {
    const lm: FaceLandmarks = {
      crownY: 3000,
      chinY: 3900,
      eyeY: 3330,
      faceCenterX: 1500,
    };
    const res = computeCropRect(lm, 3000, 4000, US);
    expect(res.warnings.some((w) => /shoulder|below/i.test(w))).toBe(true);
  });

  it("rejects a face that is too small in frame", () => {
    const lm: FaceLandmarks = {
      crownY: 100,
      chinY: 130,
      eyeY: 112,
      faceCenterX: 500,
    };
    expect(() => computeCropRect(lm, 1000, 1000, US)).toThrow(CropError);
  });

  it("rejects inverted landmarks (chin above crown)", () => {
    const lm: FaceLandmarks = {
      crownY: 2000,
      chinY: 800,
      eyeY: 1250,
      faceCenterX: 1500,
    };
    expect(() => computeCropRect(lm, 3000, 4000, US)).toThrow(CropError);
  });

  it("rejects eyes outside the crown-chin span", () => {
    const lm: FaceLandmarks = {
      crownY: 800,
      chinY: 2000,
      eyeY: 2500,
      faceCenterX: 1500,
    };
    expect(() => computeCropRect(lm, 3000, 4000, US)).toThrow(CropError);
  });

  it("rejects non-finite landmarks and bad image dimensions", () => {
    expect(() =>
      computeCropRect({ ...centered, eyeY: NaN }, 3000, 4000, US)
    ).toThrow(CropError);
    expect(() => computeCropRect(centered, 0, 4000, US)).toThrow(CropError);
    expect(() => computeCropRect(centered, 3000, -5, US)).toThrow(CropError);
  });

  it("crop rect dimensions are always positive integers", () => {
    const res = computeCropRect(centered, 3000, 4000, SCHENGEN);
    expect(Number.isInteger(res.rect.width)).toBe(true);
    expect(Number.isInteger(res.rect.height)).toBe(true);
    expect(res.rect.width).toBeGreaterThan(0);
    expect(res.rect.height).toBeGreaterThan(0);
  });
});

describe("landmarksFromNormalized", () => {
  it("converts normalized points to pixel coordinates with crown estimate", () => {
    const lm = landmarksFromNormalized(
      {
        foreheadTopY: 0.2,
        chinY: 0.5,
        leftEyeY: 0.3,
        rightEyeY: 0.32,
        leftEyeX: 0.4,
        rightEyeX: 0.6,
      },
      1000,
      2000
    );
    expect(lm.chinY).toBe(1000);
    // Crown estimated ABOVE the forehead top.
    expect(lm.crownY).toBeLessThan(0.2 * 2000);
    expect(lm.eyeY).toBeCloseTo(((0.3 + 0.32) / 2) * 2000, 5);
    expect(lm.faceCenterX).toBeCloseTo(500, 5);
  });

  it("crown estimate scales with the hair factor", () => {
    const base = {
      foreheadTopY: 0.2,
      chinY: 0.5,
      leftEyeY: 0.3,
      rightEyeY: 0.3,
      leftEyeX: 0.4,
      rightEyeX: 0.6,
    };
    const small = landmarksFromNormalized(base, 1000, 2000, 0.05);
    const big = landmarksFromNormalized(base, 1000, 2000, 0.2);
    expect(big.crownY).toBeLessThan(small.crownY);
  });
});
