/**
 * Upload hygiene — the FIRST thing every user photo passes through.
 *
 * - Magic-byte type detection (never trust extension / client MIME).
 * - 15MB cap enforced server-side (client cap is advisory).
 * - SVG rejected (XSS vector).
 * - Re-encode through sharp: normalizes format AND strips EXIF/GPS metadata
 *   (mandatory for any app handling user photos — PLAYBOOK 2.3).
 *
 * Everything downstream (bg removal, compose, compliance) receives clean,
 * metadata-free bytes.
 */

import sharp from "sharp";

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

export type DetectedType = "jpeg" | "png" | "webp";

export class IngestError extends Error {}

/** Detect image type from magic bytes. Returns null for unsupported/unknown. */
export function detectImageType(buf: Buffer): DetectedType | null {
  if (buf.length < 12) return null;
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpeg";
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  ) {
    return "png";
  }
  // WEBP: "RIFF"...."WEBP"
  if (
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) {
    return "webp";
  }
  return null;
}

export interface IngestedImage {
  /** Re-encoded PNG bytes, EXIF/GPS stripped, orientation baked in. */
  bytes: Buffer;
  width: number;
  height: number;
  originalType: DetectedType;
  contentType: "image/png";
}

/**
 * Validate + re-encode an uploaded image. Rejects anything that isn't a real
 * JPEG/PNG/WebP; the sharp round-trip strips all metadata.
 */
export async function ingestUpload(input: Buffer): Promise<IngestedImage> {
  if (input.byteLength === 0) throw new IngestError("Empty upload");
  if (input.byteLength > MAX_UPLOAD_BYTES) {
    throw new IngestError(
      `Image is too large — max ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)}MB`
    );
  }
  const type = detectImageType(input);
  if (!type) {
    throw new IngestError(
      "Unsupported image — please upload a JPEG, PNG, or WebP photo"
    );
  }

  // rotate() with no arg applies the EXIF orientation, then we drop metadata by
  // re-encoding (sharp does not copy metadata unless withMetadata() is called).
  let pipeline = sharp(input, { failOn: "error" }).rotate();
  const meta = await pipeline.metadata();
  if (!meta.width || !meta.height) {
    throw new IngestError("Could not read image dimensions");
  }
  // Guard against decompression bombs.
  if (meta.width * meta.height > 60_000_000) {
    throw new IngestError("Image resolution is too high");
  }

  const bytes = await pipeline.png().toBuffer();
  const outMeta = await sharp(bytes).metadata();

  return {
    bytes,
    width: outMeta.width ?? meta.width,
    height: outMeta.height ?? meta.height,
    originalType: type,
    contentType: "image/png",
  };
}
