/**
 * Cheap client-side dominant-clothing-color sampler: averages pixels in a
 * torso-region box below the detected chin, in canvas/image pixel space.
 * Feeds the clothing-vs-background contrast check (BUILD_PROMPT #11).
 */

export interface TorsoSampleInput {
  ctx: CanvasRenderingContext2D;
  imageWidth: number;
  imageHeight: number;
  /** Normalized (0..1) face points from lib/face-detect.ts. */
  chinY: number;
  faceCenterX: number;
  headHeightNorm: number;
}

export function sampleTorsoColor(input: TorsoSampleInput): { r: number; g: number; b: number } {
  const { ctx, imageWidth, imageHeight, chinY, faceCenterX, headHeightNorm } = input;

  // Torso box: starts ~0.6 head-heights below the chin, spans ~2 head-widths.
  const headHeightPx = headHeightNorm * imageHeight;
  const boxTop = Math.round(chinY * imageHeight + headHeightPx * 0.6);
  const boxHeight = Math.round(headHeightPx * 0.8);
  const boxWidth = Math.round(headHeightPx * 1.6);
  const boxLeft = Math.round(faceCenterX * imageWidth - boxWidth / 2);

  const left = Math.max(0, Math.min(imageWidth - 1, boxLeft));
  const top = Math.max(0, Math.min(imageHeight - 1, boxTop));
  const width = Math.max(1, Math.min(imageWidth - left, boxWidth));
  const height = Math.max(1, Math.min(imageHeight - top, boxHeight));

  try {
    const data = ctx.getImageData(left, top, width, height).data;
    let r = 0, g = 0, b = 0, count = 0;
    for (let i = 0; i < data.length; i += 4) {
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
      count += 1;
    }
    if (count === 0) return { r: 128, g: 128, b: 128 };
    return { r: Math.round(r / count), g: Math.round(g / count), b: Math.round(b / count) };
  } catch {
    // Cross-origin canvas taint or out-of-bounds — neutral gray, never blocks.
    return { r: 128, g: 128, b: 128 };
  }
}
