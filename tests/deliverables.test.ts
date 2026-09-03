import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { makeHiRes, makePrintSheetPdf } from "@/lib/deliverables";
import { getSpecOrThrow } from "@/data/photo-specs";
import { PAPER_4X6, PAPER_A4 } from "@/lib/sheet-layout";

describe("Deliverable Generation (makeHiRes & makePrintSheetPdf)", () => {
  it("makeHiRes sets density metadata to match spec DPI", async () => {
    const spec = getSpecOrThrow("us-passport"); // dpi: 300
    const raw = await sharp({
      create: { width: 600, height: 600, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
    })
      .png()
      .toBuffer();

    const hires = await makeHiRes(raw, spec);
    const meta = await sharp(hires).metadata();
    expect(meta.density).toBe(300);
  });

  it("makeHiRes sets 600 DPI for Schengen and UK specs", async () => {
    const spec = getSpecOrThrow("schengen-visa"); // dpi: 600
    const raw = await sharp({
      create: { width: 827, height: 1063, channels: 4, background: { r: 240, g: 240, b: 240, alpha: 1 } },
    })
      .png()
      .toBuffer();

    const hires = await makeHiRes(raw, spec);
    const meta = await sharp(hires).metadata();
    expect(meta.density).toBe(600);
  });

  it("makePrintSheetPdf renders a valid PDF buffer for 4x6 in paper", async () => {
    const spec = getSpecOrThrow("us-passport");
    const raw = await sharp({
      create: { width: 600, height: 600, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
    })
      .png()
      .toBuffer();

    const pdfBuffer = await makePrintSheetPdf(raw, spec, PAPER_4X6);
    expect(Buffer.isBuffer(pdfBuffer)).toBe(true);
    expect(pdfBuffer.length).toBeGreaterThan(500);
    // Standard PDF header signature: %PDF-
    expect(pdfBuffer.slice(0, 5).toString("ascii")).toBe("%PDF-");
  });

  it("makePrintSheetPdf renders a valid PDF buffer for A4 paper", async () => {
    const spec = getSpecOrThrow("schengen-visa");
    const raw = await sharp({
      create: { width: 827, height: 1063, channels: 4, background: { r: 240, g: 240, b: 240, alpha: 1 } },
    })
      .png()
      .toBuffer();

    const pdfBuffer = await makePrintSheetPdf(raw, spec, PAPER_A4);
    expect(Buffer.isBuffer(pdfBuffer)).toBe(true);
    expect(pdfBuffer.length).toBeGreaterThan(500);
    expect(pdfBuffer.slice(0, 5).toString("ascii")).toBe("%PDF-");
  });

  it("renders print sheet for unusual dimensions (Canada 50x70mm and Spain 26x32mm)", async () => {
    const canada = getSpecOrThrow("canada-passport");
    const canadaImg = await sharp({
      create: { width: 1181, height: 1654, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
    })
      .png()
      .toBuffer();

    const canadaPdf = await makePrintSheetPdf(canadaImg, canada, PAPER_A4);
    expect(canadaPdf.slice(0, 5).toString("ascii")).toBe("%PDF-");

    const spain = getSpecOrThrow("spain-passport");
    const spainImg = await sharp({
      create: { width: 614, height: 756, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
    })
      .png()
      .toBuffer();

    const spainPdf = await makePrintSheetPdf(spainImg, spain, PAPER_4X6);
    expect(spainPdf.slice(0, 5).toString("ascii")).toBe("%PDF-");
  });
});
