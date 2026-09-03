/**
 * The processing pipeline: ingested photo + face landmarks + spec → a
 * government-spec-sized processed photo.
 *
 * Steps:
 *   1. Background removal (provider; mock = passthrough).
 *   2. Compose the subject onto the spec background color (sharp flatten /
 *      composite over a solid canvas).
 *   3. Crop using lib/crop.ts geometry (head height + eye line mid-range).
 *   4. Resize to exact widthPx × heightPx at spec dpi.
 *
 * Output is the CLEAN processed photo. Watermarking for the pre-payment
 * preview is a SEPARATE server-side step (lib/watermark.ts) — the clean asset
 * must never reach the client before payment.
 */

import sharp from "sharp";
import type { PhotoSpec } from "@/data/photo-specs";
import { computeCropRect, type FaceLandmarks, type CropResult } from "@/lib/crop";
import { getBgRemovalProvider } from "@/lib/providers/bg-removal";

export interface ProcessInput {
  /** Ingested (clean, EXIF-stripped) PNG bytes. */
  imageBytes: Buffer;
  imageWidth: number;
  imageHeight: number;
  landmarks: FaceLandmarks;
  spec: PhotoSpec;
}

export interface ProcessOutput {
  /** Clean processed PNG at exact spec pixels. */
  bytes: Buffer;
  width: number;
  height: number;
  crop: CropResult;
  /** True when bg removal was mocked (background NOT actually replaced). */
  backgroundMocked: boolean;
  provider: "replicate" | "mock";
}

/** Parse "#RGB" or "#RRGGBB" → sharp RGBA. */
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.trim().replace(/^#/, "");
  if (/^[0-9a-f]{3}$/i.test(clean)) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    return { r, g, b };
  }
  const m = /^([0-9a-f]{6})$/i.exec(clean);
  if (!m) throw new Error(`Invalid hex color: ${hex}`);
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
}

export async function processPhoto(input: ProcessInput): Promise<ProcessOutput> {
  const { imageBytes, imageWidth, imageHeight, landmarks, spec } = input;

  // 1. Background removal.
  const bg = await getBgRemovalProvider().removeBackground({
    image: imageBytes,
    contentType: "image/png",
  });

  const rgb = hexToRgb(spec.bgColor);

  // 2. Compose onto the spec background.
  //    - Real (alpha) result: composite over a solid canvas of spec bg color.
  //    - Mock (no alpha): flatten just guarantees an opaque base; the subject's
  //      real background remains (flagged to the user via backgroundMocked).
  let composed: Buffer;
  if (bg.hasAlpha) {
    const base = sharp({
      create: {
        width: imageWidth,
        height: imageHeight,
        channels: 4,
        background: { ...rgb, alpha: 1 },
      },
    }).png();
    composed = await base
      .composite([{ input: bg.image, blend: "over" }])
      .png()
      .toBuffer();
  } else {
    composed = await sharp(bg.image)
      .flatten({ background: rgb })
      .png()
      .toBuffer();
  }

  // 3. Crop to spec geometry. The crop rect may extend past the source; extract
  //    within bounds and pad the remainder with the spec background color.
  const crop = computeCropRect(landmarks, imageWidth, imageHeight, spec);
  const { left, top, width, height } = crop.rect;

  const extractLeft = Math.max(0, Math.min(imageWidth, left));
  const extractTop = Math.max(0, Math.min(imageHeight, top));
  const extractRight = Math.max(0, Math.min(imageWidth, left + width));
  const extractBottom = Math.max(0, Math.min(imageHeight, top + height));
  const extractW = Math.max(0, extractRight - extractLeft);
  const extractH = Math.max(0, extractBottom - extractTop);

  let cropped: Buffer;
  if (extractW > 0 && extractH > 0) {
    const region = await sharp(composed)
      .extract({
        left: extractLeft,
        top: extractTop,
        width: extractW,
        height: extractH,
      })
      .png()
      .toBuffer();

    // Pad back to the full crop rect on a spec-colored canvas.
    const padLeft = extractLeft - left;
    const padTop = extractTop - top;
    cropped = await sharp({
      create: {
        width,
        height,
        channels: 4,
        background: { ...rgb, alpha: 1 },
      },
    })
      .composite([{ input: region, left: padLeft, top: padTop }])
      .png()
      .toBuffer();
  } else {
    // Zero overlap with source image — create a pure background canvas.
    cropped = await sharp({
      create: {
        width,
        height,
        channels: 4,
        background: { ...rgb, alpha: 1 },
      },
    })
      .png()
      .toBuffer();
  }

  // 4. Resize to exact spec pixels.
  const finalBytes = await sharp(cropped)
    .resize(spec.widthPx, spec.heightPx, { fit: "fill" })
    .withMetadata({ density: spec.dpi })
    .png()
    .toBuffer();

  return {
    bytes: finalBytes,
    width: spec.widthPx,
    height: spec.heightPx,
    crop,
    backgroundMocked: bg.mocked,
    provider: bg.provider,
  };
}
