/**
 * Crop math — pure, unit-tested. Given face landmarks in source-image pixel
 * coordinates and a photo spec, compute the crop rectangle that places the
 * head height and eye line at the midpoint of the spec's allowed ranges.
 *
 * The crop rect MAY extend beyond the source image bounds: the pipeline
 * composites the background-removed subject onto a generated background
 * canvas, so out-of-bounds regions simply become background color.
 */

import type { PhotoSpec } from "@/data/photo-specs";

export interface FaceLandmarks {
  /** Estimated top of head INCLUDING hair, y px in source image. */
  crownY: number;
  /** Bottom of chin, y px. */
  chinY: number;
  /** Midpoint between pupil centers, y px. */
  eyeY: number;
  /** Horizontal face center (between the eyes), x px. */
  faceCenterX: number;
}

export interface CropRect {
  /** May be negative (crop extends past the left/top edge). */
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface CropResult {
  rect: CropRect;
  /** Achieved head height as % of crop height. */
  headHeightPct: number;
  /** Achieved eye line from the BOTTOM as % of crop height. */
  eyeLinePct: number;
  /** Non-fatal issues (e.g. subject too close to an edge). */
  warnings: string[];
}

const mid = (a: number, b: number) => (a + b) / 2;

export class CropError extends Error {}

/**
 * Compute the ideal crop rect for a spec.
 *
 * Strategy:
 *  1. Head height (crownY..chinY) should equal mid(headHeightPctMin/Max)% of
 *     the crop height -> fixes crop height.
 *  2. Eye line should sit at mid(eyeLinePctMin/Max)% from the crop bottom ->
 *     fixes crop top.
 *  3. Face centered horizontally -> fixes crop left.
 *  4. If the resulting rect extends past image edges, we keep it (background
 *     fill) but emit warnings when a significant part of the SUBJECT side
 *     (bottom, where shoulders are) would be synthetic.
 */
export function computeCropRect(
  landmarks: FaceLandmarks,
  imageWidth: number,
  imageHeight: number,
  spec: PhotoSpec
): CropResult {
  const { crownY, chinY, eyeY, faceCenterX } = landmarks;

  if (!Number.isFinite(crownY) || !Number.isFinite(chinY) || !Number.isFinite(eyeY)) {
    throw new CropError("Invalid landmarks: non-finite coordinates");
  }
  if (imageWidth <= 0 || imageHeight <= 0) {
    throw new CropError("Invalid image dimensions");
  }
  const headPx = chinY - crownY;
  if (headPx <= 0) {
    throw new CropError("Invalid landmarks: chin must be below crown");
  }
  if (eyeY <= crownY || eyeY >= chinY) {
    throw new CropError("Invalid landmarks: eyes must sit between crown and chin");
  }
  // A usable crop needs the face to be a sane fraction of the frame.
  if (headPx < 40) {
    throw new CropError(
      "Face too small in frame — move closer to the camera (head must be at least ~40px tall)"
    );
  }

  const warnings: string[] = [];

  const targetHeadPct = mid(spec.headHeightPctMin, spec.headHeightPctMax);
  const targetEyePct = mid(spec.eyeLinePctMin, spec.eyeLinePctMax);

  const cropHeight = headPx / (targetHeadPct / 100);
  const aspect = spec.widthPx / spec.heightPx;
  const cropWidth = cropHeight * aspect;

  // Eye line measured from the bottom: distance from crop TOP to the eyes.
  const eyeFromTop = cropHeight * (1 - targetEyePct / 100);
  const top = eyeY - eyeFromTop;

  const width = Math.max(1, Math.round(cropWidth));
  const height = Math.max(1, Math.round(cropHeight));
  // Center on the face using the ROUNDED width so the rect's center stays as
  // close as possible to faceCenterX (error <= 0.5px for odd widths).
  const rect: CropRect = {
    left: Math.round(faceCenterX - width / 2),
    top: Math.round(top),
    width,
    height,
  };

  // Warnings: synthetic background is fine above/beside the head, but if the
  // crop extends far below the image the shoulders get cut off visibly.
  const bottomOverflow = rect.top + rect.height - imageHeight;
  if (bottomOverflow > cropHeight * 0.18) {
    warnings.push(
      "Not enough room below the chin — include your shoulders and upper chest in the shot"
    );
  }
  const sideOverflow = Math.max(-rect.left, rect.left + rect.width - imageWidth);
  if (sideOverflow > cropWidth * 0.25) {
    warnings.push(
      "Face is close to the photo edge — center yourself and leave space on both sides"
    );
  }
  if (rect.top < -cropHeight * 0.3) {
    warnings.push(
      "Not enough room above the head — hold the camera slightly higher or step back"
    );
  }

  // Achieved metrics (exact by construction, useful for the compliance report).
  const headHeightPct = (headPx / rect.height) * 100;
  const eyeLinePct = ((rect.top + rect.height - eyeY) / rect.height) * 100;

  return { rect, headHeightPct, eyeLinePct, warnings };
}

/**
 * Convert MediaPipe-style normalized landmarks (0..1) to pixel FaceLandmarks.
 * `foreheadTopY` is the topmost face-oval landmark; the crown (incl. hair) is
 * estimated above it by a fraction of the forehead-to-chin distance — the
 * standard estimate used by photo tools since hair is not landmarked.
 */
export function landmarksFromNormalized(
  points: {
    foreheadTopY: number;
    chinY: number;
    leftEyeY: number;
    rightEyeY: number;
    leftEyeX: number;
    rightEyeX: number;
  },
  imageWidth: number,
  imageHeight: number,
  crownHairFactor = 0.12
): FaceLandmarks {
  const chinY = points.chinY * imageHeight;
  const foreheadY = points.foreheadTopY * imageHeight;
  const faceSpan = chinY - foreheadY;
  const crownY = foreheadY - faceSpan * crownHairFactor;
  const eyeY = ((points.leftEyeY + points.rightEyeY) / 2) * imageHeight;
  const faceCenterX = ((points.leftEyeX + points.rightEyeX) / 2) * imageWidth;
  return { crownY, chinY, eyeY, faceCenterX };
}
