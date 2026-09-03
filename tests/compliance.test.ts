import { describe, it, expect } from "vitest";
import {
  runComplianceChecks,
  colorDistance,
  luminance,
  type ComplianceInput,
} from "@/lib/compliance";
import { getSpecOrThrow } from "@/data/photo-specs";

const US = getSpecOrThrow("us-passport"); // smileAllowed: true, glasses: false
const SCHENGEN = getSpecOrThrow("schengen-visa");
const BABY = getSpecOrThrow("us-passport-baby");

/** A perfectly compliant US-passport input, mid-range on everything. */
function goodInput(spec = US): ComplianceInput {
  return {
    headHeightPct: (spec.headHeightPctMin + spec.headHeightPctMax) / 2,
    eyeLinePct: (spec.eyeLinePctMin + spec.eyeLinePctMax) / 2,
    faceTiltDeg: 1,
    leftEyeClosed: 0.05,
    rightEyeClosed: 0.05,
    smileScore: 0.1,
    faceCount: 1,
    glassesDetected: false,
    faceBrightness: 150,
    faceContrast: 40,
    clothingRgb: { r: 40, g: 60, b: 120 }, // dark navy top vs white bg
    backgroundMocked: false,
  };
}

const findCheck = (r: ReturnType<typeof runComplianceChecks>, id: string) =>
  r.checks.find((c) => c.id === id)!;

describe("helpers", () => {
  it("luminance and colorDistance behave", () => {
    expect(luminance({ r: 255, g: 255, b: 255 })).toBeCloseTo(255, 0);
    expect(luminance({ r: 0, g: 0, b: 0 })).toBe(0);
    expect(colorDistance({ r: 0, g: 0, b: 0 }, { r: 0, g: 0, b: 0 })).toBe(0);
    expect(
      colorDistance({ r: 255, g: 255, b: 255 }, { r: 0, g: 0, b: 0 })
    ).toBeGreaterThan(400);
  });
});

describe("runComplianceChecks", () => {
  it("all-green input is purchasable", () => {
    const r = runComplianceChecks(goodInput(), US);
    expect(r.overall).toBe("pass");
    expect(r.purchasable).toBe(true);
  });

  it("two faces → FAIL, blocks purchase", () => {
    const r = runComplianceChecks({ ...goodInput(), faceCount: 2 }, US);
    expect(findCheck(r, "single-face").status).toBe("fail");
    expect(r.purchasable).toBe(false);
  });

  it("closed eyes → FAIL for adults", () => {
    const r = runComplianceChecks(
      { ...goodInput(), leftEyeClosed: 0.9 },
      US
    );
    expect(findCheck(r, "eyes-open").status).toBe("fail");
    expect(r.purchasable).toBe(false);
  });

  it("closed eyes → WARN (not fail) in baby mode", () => {
    const r = runComplianceChecks(
      { ...goodInput(BABY), leftEyeClosed: 0.9 },
      BABY
    );
    expect(findCheck(r, "eyes-open").status).toBe("warn");
    expect(r.purchasable).toBe(true);
  });

  it("smiling → FAIL when spec forbids smiling (Schengen)", () => {
    expect(SCHENGEN.smileAllowed).toBe(false);
    const r = runComplianceChecks({ ...goodInput(SCHENGEN), smileScore: 0.8 }, SCHENGEN);
    expect(findCheck(r, "neutral-expression").status).toBe("fail");
  });

  it("smiling is fine when spec allows it (US)", () => {
    const r = runComplianceChecks({ ...goodInput(), smileScore: 0.9 }, US);
    expect(r.checks.find((c) => c.id === "neutral-expression")).toBeUndefined();
    expect(r.overall).toBe("pass");
  });

  it("tilt beyond 5° → WARN, not fail", () => {
    const r = runComplianceChecks({ ...goodInput(), faceTiltDeg: 12 }, US);
    expect(findCheck(r, "face-straight").status).toBe("warn");
    expect(r.purchasable).toBe(true);
  });

  it("glasses when disallowed → WARN (uncertain heuristic never fails)", () => {
    const r = runComplianceChecks({ ...goodInput(), glassesDetected: true }, US);
    expect(findCheck(r, "glasses").status).toBe("warn");
    expect(r.purchasable).toBe(true);
  });

  it("dark photo → brightness WARN", () => {
    const r = runComplianceChecks({ ...goodInput(), faceBrightness: 30 }, US);
    expect(findCheck(r, "brightness").status).toBe("warn");
  });

  it("white-on-white clothing → clothing-contrast WARN", () => {
    const r = runComplianceChecks(
      { ...goodInput(), clothingRgb: { r: 250, g: 250, b: 250 } },
      US
    );
    expect(findCheck(r, "clothing-contrast").status).toBe("warn");
  });

  it("mocked background → background WARN (preview honesty)", () => {
    const r = runComplianceChecks({ ...goodInput(), backgroundMocked: true }, US);
    expect(findCheck(r, "background").status).toBe("warn");
    expect(r.purchasable).toBe(true);
  });

  it("head too small → FAIL with reshoot tip", () => {
    const r = runComplianceChecks({ ...goodInput(), headHeightPct: 20 }, US);
    const c = findCheck(r, "head-height");
    expect(c.status).toBe("fail");
    expect(c.tip).toMatch(/too small/i);
    expect(r.purchasable).toBe(false);
  });

  it("head too large → FAIL with reshoot tip", () => {
    const r = runComplianceChecks({ ...goodInput(), headHeightPct: 85 }, US);
    const c = findCheck(r, "head-height");
    expect(c.status).toBe("fail");
    expect(c.tip).toMatch(/too large/i);
    expect(r.purchasable).toBe(false);
  });

  it("zero faces detected → FAIL, blocks purchase", () => {
    const r = runComplianceChecks({ ...goodInput(), faceCount: 0 }, US);
    expect(findCheck(r, "single-face").status).toBe("fail");
    expect(r.purchasable).toBe(false);
  });

  it("over-exposed photo (brightness > 235) → brightness WARN", () => {
    const r = runComplianceChecks({ ...goodInput(), faceBrightness: 245 }, US);
    expect(findCheck(r, "brightness").status).toBe("warn");
    expect(findCheck(r, "brightness").tip).toMatch(/over-exposed/i);
  });

  it("flat / washed-out photo (contrast < 12) → contrast WARN", () => {
    const r = runComplianceChecks({ ...goodInput(), faceContrast: 8 }, US);
    expect(findCheck(r, "contrast").status).toBe("warn");
  });

  it("smiling in infant mode → WARN (not fail) for strict smile specs", () => {
    // Strict baby spec (e.g. Schengen which forbids smiling for adults)
    const strictBabySpec = { ...SCHENGEN, infant: true };
    const res = runComplianceChecks({ ...goodInput(strictBabySpec), smileScore: 0.8 }, strictBabySpec);
    expect(findCheck(res, "neutral-expression").status).toBe("warn");
    expect(res.purchasable).toBe(true);
  });

  it("handles non-finite numbers safely in compliance check without throwing", () => {
    const r = runComplianceChecks(
      {
        ...goodInput(),
        headHeightPct: NaN,
        eyeLinePct: Infinity,
        faceTiltDeg: -Infinity,
      },
      US
    );
    expect(findCheck(r, "head-height").status).toBe("fail");
    expect(findCheck(r, "eye-line").status).toBe("warn");
    expect(r.purchasable).toBe(false);
  });
});
