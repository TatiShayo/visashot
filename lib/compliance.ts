/**
 * Compliance checker — the trust engine. Pure function: given the achieved
 * crop geometry, landmark-derived signals, image stats, and the spec, produce
 * a checklist of PASS / WARN / FAIL items.
 *
 * Doctrine (BUILD_PROMPT #3):
 *   - FAIL blocks purchase and says exactly how to reshoot.
 *   - WARN is advisory (uncertain heuristics WARN, never FAIL).
 *   - Baby mode: eyes-open + neutral-expression downgraded to WARN per
 *     official infant exemptions; landmark confidence relaxed.
 */

import type { PhotoSpec } from "@/data/photo-specs";
import { hexToRgb } from "@/lib/pipeline";

export type CheckStatus = "pass" | "warn" | "fail";

export interface CheckItem {
  id: string;
  label: string;
  status: CheckStatus;
  /** Shown for warn/fail — how to fix / reshoot. */
  tip?: string;
}

export interface ComplianceInput {
  /** Achieved head height as % of the processed photo height. */
  headHeightPct: number;
  /** Achieved eye line from the bottom, %. */
  eyeLinePct: number;
  /** Roll angle of the face in degrees (0 = level). */
  faceTiltDeg: number;
  /** MediaPipe eye-blink blendshape scores, 0..1 (higher = more closed). */
  leftEyeClosed: number;
  rightEyeClosed: number;
  /** Mouth "smile" blendshape score 0..1 (for neutral-expression specs). */
  smileScore: number;
  /** Number of faces detected. */
  faceCount: number;
  /** Whether a glasses heuristic fired (uncertain → WARN). */
  glassesDetected: boolean;
  /** Mean luminance of the face region, 0..255. */
  faceBrightness: number;
  /** Std-dev of luminance in the face region (contrast proxy). */
  faceContrast: number;
  /** Dominant clothing (torso) color, RGB. */
  clothingRgb: { r: number; g: number; b: number };
  /** True when bg removal was mocked (background not actually replaced). */
  backgroundMocked: boolean;
}

const EYE_CLOSED_THRESHOLD = 0.5;
const SMILE_THRESHOLD = 0.45;
const TILT_WARN_DEG = 5;

/** Perceived luminance of an RGB color, 0..255. */
export function luminance(rgb: { r: number; g: number; b: number }): number {
  return 0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b;
}

/** Euclidean distance between two RGB colors (0..~441). */
export function colorDistance(
  a: { r: number; g: number; b: number },
  b: { r: number; g: number; b: number }
): number {
  return Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2);
}

const worst = (a: CheckStatus, b: CheckStatus): CheckStatus => {
  const rank = { pass: 0, warn: 1, fail: 2 } as const;
  return rank[a] >= rank[b] ? a : b;
};

export interface ComplianceResult {
  overall: CheckStatus;
  checks: CheckItem[];
  /** True when no FAIL — purchase allowed. */
  purchasable: boolean;
}

export function runComplianceChecks(
  input: ComplianceInput,
  spec: PhotoSpec
): ComplianceResult {
  const isBaby = Boolean(spec.infant);
  const checks: CheckItem[] = [];

  // 1. Single face.
  if (input.faceCount === 0) {
    checks.push({
      id: "single-face",
      label: "One face in the frame",
      status: "fail",
      tip: "No face detected — make sure your whole head is visible and well lit.",
    });
  } else if (input.faceCount > 1) {
    checks.push({
      id: "single-face",
      label: "One face in the frame",
      status: "fail",
      tip: "More than one face detected — the subject must be alone in the photo.",
    });
  } else {
    checks.push({ id: "single-face", label: "One face in the frame", status: "pass" });
  }

  // 2. Head height.
  {
    const inRange =
      Number.isFinite(input.headHeightPct) &&
      input.headHeightPct >= spec.headHeightPctMin - 1 &&
      input.headHeightPct <= spec.headHeightPctMax + 1;
    checks.push({
      id: "head-height",
      label: `Head size (${spec.headHeightPctMin}–${spec.headHeightPctMax}% of photo)`,
      status: inRange ? "pass" : "fail",
      tip: inRange
        ? undefined
        : (!Number.isFinite(input.headHeightPct) || input.headHeightPct < spec.headHeightPctMin)
          ? "Head is too small — move closer or retake so your head fills more of the frame."
          : "Head is too large — step back slightly and retake.",
    });
  }

  // 3. Eye line.
  {
    const inRange =
      Number.isFinite(input.eyeLinePct) &&
      input.eyeLinePct >= spec.eyeLinePctMin - 1 &&
      input.eyeLinePct <= spec.eyeLinePctMax + 1;
    checks.push({
      id: "eye-line",
      label: "Eye position within spec",
      status: inRange ? "pass" : "warn",
      tip: inRange ? undefined : "Eye line is slightly off — recentre and hold the camera at eye level.",
    });
  }

  // 4. Face tilt / straightness.
  {
    const tilt = Math.abs(input.faceTiltDeg);
    checks.push({
      id: "face-straight",
      label: "Face level and straight",
      status: tilt <= TILT_WARN_DEG ? "pass" : "warn",
      tip: tilt <= TILT_WARN_DEG ? undefined : "Tilt your head to level and face the camera straight on.",
    });
  }

  // 5. Both eyes open (baby → WARN per exemption).
  {
    const closed =
      input.leftEyeClosed > EYE_CLOSED_THRESHOLD ||
      input.rightEyeClosed > EYE_CLOSED_THRESHOLD;
    const status: CheckStatus = closed ? (isBaby ? "warn" : "fail") : "pass";
    checks.push({
      id: "eyes-open",
      label: "Both eyes open",
      status,
      tip: closed
        ? isBaby
          ? "Infant exemption: eyes-open is not strictly required, but open eyes are preferred if you can manage it."
          : "One or both eyes look closed — keep your eyes open and retake."
        : undefined,
    });
  }

  // 6. Neutral expression (only when smiling is not allowed; baby → WARN).
  if (!spec.smileAllowed) {
    const smiling = input.smileScore > SMILE_THRESHOLD;
    const status: CheckStatus = smiling ? (isBaby ? "warn" : "fail") : "pass";
    checks.push({
      id: "neutral-expression",
      label: "Neutral expression, mouth closed",
      status,
      tip: smiling
        ? isBaby
          ? "Infant exemption: a neutral expression is preferred but not required."
          : "This spec requires a neutral expression — relax your mouth and retake."
        : undefined,
    });
  }

  // 7. Glasses (heuristic → WARN when not allowed; exemption noted).
  if (!spec.glassesAllowed && input.glassesDetected) {
    checks.push({
      id: "glasses",
      label: "No glasses",
      status: "warn",
      tip:
        (spec.exemptionNotes ? `${spec.exemptionNotes} ` : "") +
        "We may have detected glasses — remove them unless you have a medical exemption.",
    });
  } else if (!spec.glassesAllowed) {
    checks.push({ id: "glasses", label: "No glasses", status: "pass" });
  }

  // 8. Brightness.
  {
    const dark = input.faceBrightness < 60;
    const bright = input.faceBrightness > 235;
    const status: CheckStatus = dark || bright ? "warn" : "pass";
    checks.push({
      id: "brightness",
      label: "Even, natural lighting",
      status,
      tip: dark
        ? "The photo looks dark — face a window or add soft light and retake."
        : bright
          ? "The photo looks over-exposed — reduce direct light and retake."
          : undefined,
    });
  }

  // 9. Contrast (flat/washed-out).
  {
    const flat = input.faceContrast < 12;
    checks.push({
      id: "contrast",
      label: "Adequate contrast",
      status: flat ? "warn" : "pass",
      tip: flat ? "The image looks flat — improve lighting for more definition." : undefined,
    });
  }

  // 10. Clothing vs background contrast (white-on-white is a top rejection).
  {
    const bg = hexToRgb(spec.bgColor);
    const dist = colorDistance(input.clothingRgb, bg);
    const tooClose = dist < 60;
    checks.push({
      id: "clothing-contrast",
      label: "Clothing stands out from the background",
      status: tooClose ? "warn" : "pass",
      tip: tooClose
        ? `Your clothing is close to the ${spec.bgColor} background — wear a contrasting top so your outline is clear.`
        : undefined,
    });
  }

  // 11. Background replacement status (mock transparency).
  if (input.backgroundMocked) {
    checks.push({
      id: "background",
      label: "Compliant background",
      status: "warn",
      tip: "Background replacement is running in preview mode — the final purchased photo will have the exact spec background.",
    });
  } else {
    checks.push({ id: "background", label: "Compliant background", status: "pass" });
  }

  const overall = checks.reduce<CheckStatus>((acc, c) => worst(acc, c.status), "pass");
  return {
    overall,
    checks,
    purchasable: overall !== "fail",
  };
}
