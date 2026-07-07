/**
 * Server-side watermarking for the pre-payment preview.
 *
 * SECURITY (BUILD_PROMPT): the clean processed photo is the product. The
 * un-watermarked result must NEVER leave the server before payment. This runs
 * on the server; the client only ever receives the watermarked bytes until the
 * order is paid. A security test asserts no clean asset appears in any
 * pre-payment response.
 */

import sharp from "sharp";

/** Build a tiled diagonal "VISASHOT — PREVIEW" SVG overlay sized to the image. */
function watermarkSvg(width: number, height: number): Buffer {
  const step = Math.max(120, Math.round(width / 3));
  const fontSize = Math.max(16, Math.round(width / 22));
  const lines: string[] = [];
  for (let y = -height; y < height * 2; y += step) {
    for (let x = -width; x < width * 2; x += step) {
      lines.push(
        `<text x="${x}" y="${y}" font-family="monospace" font-size="${fontSize}" ` +
          `fill="rgba(27,42,74,0.28)" transform="rotate(-30 ${x} ${y})">VISASHOT · PREVIEW</text>`
      );
    }
  }
  return Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${lines.join(
      ""
    )}</svg>`
  );
}

/**
 * Apply a diagonal watermark to processed photo bytes. Returns NEW bytes; the
 * clean input is discarded by the caller before responding to the client.
 */
export async function applyWatermark(cleanBytes: Buffer): Promise<Buffer> {
  const img = sharp(cleanBytes);
  const meta = await img.metadata();
  const width = meta.width ?? 600;
  const height = meta.height ?? 600;
  const overlay = watermarkSvg(width, height);
  return img
    .composite([{ input: overlay, blend: "over" }])
    .png()
    .toBuffer();
}
