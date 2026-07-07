import { describe, it, expect } from "vitest";
import sharp from "sharp";
import {
  detectImageType,
  ingestUpload,
  IngestError,
  MAX_UPLOAD_BYTES,
} from "@/lib/image-ingest";
import { hexToRgb, processPhoto } from "@/lib/pipeline";
import { getSpecOrThrow } from "@/data/photo-specs";
import type { FaceLandmarks } from "@/lib/crop";

const US = getSpecOrThrow("us-passport");
const SCHENGEN = getSpecOrThrow("schengen-visa");

async function makePng(w: number, h: number): Promise<Buffer> {
  return sharp({
    create: { width: w, height: h, channels: 3, background: { r: 120, g: 130, b: 140 } },
  })
    .png()
    .toBuffer();
}

async function makeJpegWithExif(): Promise<Buffer> {
  // sharp writes EXIF only via withMetadata + exif option; embed a GPS-ish tag.
  return sharp({
    create: { width: 200, height: 200, channels: 3, background: { r: 10, g: 20, b: 30 } },
  })
    .withMetadata({ exif: { IFD0: { Copyright: "test", ImageDescription: "hasmeta" } } })
    .jpeg()
    .toBuffer();
}

describe("detectImageType", () => {
  it("detects PNG and JPEG by magic bytes", async () => {
    const png = await makePng(10, 10);
    const jpeg = await sharp(png).jpeg().toBuffer();
    expect(detectImageType(png)).toBe("png");
    expect(detectImageType(jpeg)).toBe("jpeg");
  });

  it("rejects non-image and too-short buffers", () => {
    expect(detectImageType(Buffer.from("not an image at all here"))).toBeNull();
    expect(detectImageType(Buffer.from([0x00, 0x01]))).toBeNull();
    // SVG starts with '<' — not a supported magic byte.
    expect(detectImageType(Buffer.from("<svg xmlns='...'></svg>"))).toBeNull();
  });
});

describe("ingestUpload", () => {
  it("re-encodes to PNG and strips EXIF metadata", async () => {
    const jpeg = await makeJpegWithExif();
    const before = await sharp(jpeg).metadata();
    expect(before.exif).toBeTruthy(); // sanity: input had metadata

    const out = await ingestUpload(jpeg);
    expect(out.contentType).toBe("image/png");
    expect(out.originalType).toBe("jpeg");
    const after = await sharp(out.bytes).metadata();
    expect(after.exif).toBeFalsy(); // EXIF stripped by re-encode
    expect(out.width).toBe(200);
    expect(out.height).toBe(200);
  });

  it("rejects empty, oversized, and non-image uploads", async () => {
    await expect(ingestUpload(Buffer.alloc(0))).rejects.toBeInstanceOf(IngestError);
    await expect(
      ingestUpload(Buffer.from("this is definitely not an image file"))
    ).rejects.toBeInstanceOf(IngestError);
    const huge = Buffer.alloc(MAX_UPLOAD_BYTES + 1, 0xff);
    huge[0] = 0xff;
    huge[1] = 0xd8;
    huge[2] = 0xff;
    await expect(ingestUpload(huge)).rejects.toBeInstanceOf(IngestError);
  });
});

describe("hexToRgb", () => {
  it("parses hex with and without leading #", () => {
    expect(hexToRgb("#FFFFFF")).toEqual({ r: 255, g: 255, b: 255 });
    expect(hexToRgb("f0f0f0")).toEqual({ r: 240, g: 240, b: 240 });
    expect(hexToRgb("#1B2A4A")).toEqual({ r: 27, g: 42, b: 74 });
  });
  it("throws on invalid hex", () => {
    expect(() => hexToRgb("nope")).toThrow();
    expect(() => hexToRgb("#12345")).toThrow();
  });
});

describe("processPhoto (mock bg-removal)", () => {
  const landmarks: FaceLandmarks = {
    crownY: 800,
    chinY: 2000,
    eyeY: 1250,
    faceCenterX: 1500,
  };

  it("produces a PNG at EXACT spec pixel dimensions", async () => {
    const bytes = await makePng(3000, 4000);
    for (const spec of [US, SCHENGEN]) {
      const out = await processPhoto({
        imageBytes: bytes,
        imageWidth: 3000,
        imageHeight: 4000,
        landmarks,
        spec,
      });
      expect(out.width).toBe(spec.widthPx);
      expect(out.height).toBe(spec.heightPx);
      const meta = await sharp(out.bytes).metadata();
      expect(meta.width).toBe(spec.widthPx);
      expect(meta.height).toBe(spec.heightPx);
      // No key configured in test env → mock provider.
      expect(out.backgroundMocked).toBe(true);
      expect(out.provider).toBe("mock");
    }
  });

  it("handles a crop that overflows the source (background-padded)", async () => {
    // Tiny source but valid landmarks: crop rect extends past edges.
    const bytes = await makePng(500, 4000);
    const out = await processPhoto({
      imageBytes: bytes,
      imageWidth: 500,
      imageHeight: 4000,
      landmarks: { crownY: 500, chinY: 1400, eyeY: 840, faceCenterX: 250 },
      spec: US,
    });
    expect(out.width).toBe(US.widthPx);
    expect(out.height).toBe(US.heightPx);
  });
});
