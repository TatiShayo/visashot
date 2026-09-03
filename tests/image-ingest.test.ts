import { describe, it, expect } from "vitest";
import sharp from "sharp";
import {
  detectImageType,
  ingestUpload,
  IngestError,
  MAX_UPLOAD_BYTES,
} from "@/lib/image-ingest";

describe("detectImageType", () => {
  it("detects JPEG magic bytes", () => {
    const buf = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
    expect(detectImageType(buf)).toBe("jpeg");
  });

  it("detects PNG magic bytes", () => {
    const buf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
    expect(detectImageType(buf)).toBe("png");
  });

  it("detects WebP magic bytes", () => {
    const buf = Buffer.from([
      0x52, 0x49, 0x46, 0x46, // RIFF
      0x24, 0x00, 0x00, 0x00,
      0x57, 0x45, 0x42, 0x50, // WEBP
    ]);
    expect(detectImageType(buf)).toBe("webp");
  });

  it("returns null for short buffers (<12 bytes)", () => {
    expect(detectImageType(Buffer.from([0xff, 0xd8, 0xff]))).toBeNull();
    expect(detectImageType(Buffer.alloc(0))).toBeNull();
    expect(detectImageType(Buffer.alloc(11))).toBeNull();
  });

  it("returns null for non-image / unsupported formats", () => {
    // SVG / XML
    expect(detectImageType(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'></svg>"))).toBeNull();
    // PDF
    expect(detectImageType(Buffer.from("%PDF-1.4\n%..."))).toBeNull();
    // HTML / Plaintext
    expect(detectImageType(Buffer.from("<!DOCTYPE html><html></html>"))).toBeNull();
    // Random binary
    expect(detectImageType(Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b]))).toBeNull();
  });
});

describe("ingestUpload", () => {
  it("rejects empty buffer", async () => {
    await expect(ingestUpload(Buffer.alloc(0))).rejects.toThrow(IngestError);
  });

  it("rejects upload exceeding MAX_UPLOAD_BYTES", async () => {
    const oversized = Buffer.alloc(MAX_UPLOAD_BYTES + 1);
    await expect(ingestUpload(oversized)).rejects.toThrow(IngestError);
  });

  it("rejects unsupported MIME / magic bytes", async () => {
    const fakeText = Buffer.from("Hello world, I am not an image file at all!");
    await expect(ingestUpload(fakeText)).rejects.toThrow("Unsupported image");
  });

  it("successfully ingests a valid PNG buffer", async () => {
    const png = await sharp({
      create: { width: 100, height: 100, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 1 } },
    })
      .png()
      .toBuffer();

    const ingested = await ingestUpload(png);
    expect(ingested.width).toBe(100);
    expect(ingested.height).toBe(100);
    expect(ingested.originalType).toBe("png");
    expect(ingested.contentType).toBe("image/png");
    expect(Buffer.isBuffer(ingested.bytes)).toBe(true);
    expect(ingested.bytes.length).toBeGreaterThan(0);
  });

  it("successfully ingests a valid JPEG buffer and outputs normalized PNG", async () => {
    const jpeg = await sharp({
      create: { width: 120, height: 160, channels: 3, background: { r: 0, g: 128, b: 255 } },
    })
      .jpeg()
      .toBuffer();

    const ingested = await ingestUpload(jpeg);
    expect(ingested.width).toBe(120);
    expect(ingested.height).toBe(160);
    expect(ingested.originalType).toBe("jpeg");
    expect(ingested.contentType).toBe("image/png");
    // Verify output is readable by sharp as PNG
    const meta = await sharp(ingested.bytes).metadata();
    expect(meta.format).toBe("png");
  });

  it("successfully ingests a valid WebP buffer", async () => {
    const webp = await sharp({
      create: { width: 80, height: 90, channels: 4, background: { r: 50, g: 200, b: 50, alpha: 1 } },
    })
      .webp()
      .toBuffer();

    const ingested = await ingestUpload(webp);
    expect(ingested.width).toBe(80);
    expect(ingested.height).toBe(90);
    expect(ingested.originalType).toBe("webp");
    expect(ingested.contentType).toBe("image/png");
  });

  it("strips EXIF / GPS metadata during ingestion", async () => {
    // Generate an image with EXIF metadata
    const imgWithExif = await sharp({
      create: { width: 60, height: 60, channels: 3, background: { r: 100, g: 100, b: 100 } },
    })
      .withMetadata({
        exif: {
          IFD0: {
            Artist: "Secret User Name",
            Make: "TestCamera",
          },
        },
      })
      .jpeg()
      .toBuffer();

    const ingested = await ingestUpload(imgWithExif);
    const meta = await sharp(ingested.bytes).metadata();
    expect(meta.exif).toBeUndefined();
  });

  it("rejects corrupt or malformed image data with valid magic bytes", async () => {
    // PNG magic bytes followed by garbage
    const corruptPng = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.from("completely corrupt payload that cannot be decoded"),
    ]);

    await expect(ingestUpload(corruptPng)).rejects.toThrow(IngestError);
  });
});
