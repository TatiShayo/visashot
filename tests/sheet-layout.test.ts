import { describe, it, expect } from "vitest";
import {
  computeSheetLayout,
  LayoutError,
  PAPER_4X6,
  PAPER_A4,
  SHEET_MARGIN_MM,
  mmToPt,
} from "@/lib/sheet-layout";
import { PHOTO_SPECS } from "@/data/photo-specs";

function assertNoOverlapAndInBounds(
  layout: ReturnType<typeof computeSheetLayout>
) {
  const { photos, paper } = layout;
  for (const p of photos) {
    expect(p.xMm).toBeGreaterThanOrEqual(SHEET_MARGIN_MM - 1e-6);
    expect(p.yMm).toBeGreaterThanOrEqual(SHEET_MARGIN_MM - 1e-6);
    expect(p.xMm + p.widthMm).toBeLessThanOrEqual(paper.widthMm - SHEET_MARGIN_MM + 1e-6);
    expect(p.yMm + p.heightMm).toBeLessThanOrEqual(paper.heightMm - SHEET_MARGIN_MM + 1e-6);
  }
  for (let i = 0; i < photos.length; i++) {
    for (let j = i + 1; j < photos.length; j++) {
      const a = photos[i];
      const b = photos[j];
      const overlap =
        a.xMm < b.xMm + b.widthMm &&
        b.xMm < a.xMm + a.widthMm &&
        a.yMm < b.yMm + b.heightMm &&
        b.yMm < a.yMm + a.heightMm;
      expect(overlap, `photos ${i} and ${j} overlap`).toBe(false);
    }
  }
}

describe("computeSheetLayout", () => {
  it("US passport (51x51) on 4x6: 2 photos across, correct physical size", () => {
    const layout = computeSheetLayout(51, 51, PAPER_4X6);
    expect(layout.columns).toBe(2);
    expect(layout.rows).toBe(1);
    expect(layout.photos).toHaveLength(2);
    expect(layout.photos[0].widthMm).toBe(51);
    assertNoOverlapAndInBounds(layout);
  });

  it("35x45 on 4x6: at least 4 photos", () => {
    const layout = computeSheetLayout(35, 45, PAPER_4X6);
    expect(layout.photos.length).toBeGreaterThanOrEqual(4);
    assertNoOverlapAndInBounds(layout);
  });

  it("35x45 on A4: capped at 8 photos", () => {
    const layout = computeSheetLayout(35, 45, PAPER_A4);
    expect(layout.photos.length).toBeLessThanOrEqual(8);
    expect(layout.photos.length).toBeGreaterThanOrEqual(4);
    assertNoOverlapAndInBounds(layout);
  });

  it("every spec in the database fits both papers with 1-8 photos", () => {
    for (const spec of PHOTO_SPECS) {
      for (const paper of [PAPER_4X6, PAPER_A4]) {
        const layout = computeSheetLayout(spec.widthMm, spec.heightMm, paper);
        expect(layout.photos.length).toBeGreaterThanOrEqual(1);
        expect(layout.photos.length).toBeLessThanOrEqual(8);
        assertNoOverlapAndInBounds(layout);
      }
    }
  });

  it("large photo (Canada 50x70) on 4x6 still fits at least 1", () => {
    const layout = computeSheetLayout(50, 70, PAPER_4X6);
    expect(layout.photos.length).toBeGreaterThanOrEqual(1);
    assertNoOverlapAndInBounds(layout);
  });

  it("cut guides align with photo edges", () => {
    const layout = computeSheetLayout(35, 45, PAPER_4X6);
    for (const p of layout.photos) {
      expect(layout.cutXs).toContain(p.xMm);
      expect(layout.cutXs).toContain(p.xMm + p.widthMm);
      expect(layout.cutYs).toContain(p.yMm);
      expect(layout.cutYs).toContain(p.yMm + p.heightMm);
    }
  });

  it("photo block is centered on the page", () => {
    const layout = computeSheetLayout(35, 45, PAPER_A4);
    const minX = Math.min(...layout.photos.map((p) => p.xMm));
    const maxX = Math.max(...layout.photos.map((p) => p.xMm + p.widthMm));
    expect(minX).toBeCloseTo(layout.paper.widthMm - maxX, 5);
  });

  it("rejects photos that cannot fit and invalid dimensions", () => {
    expect(() => computeSheetLayout(200, 200, PAPER_4X6)).toThrow(LayoutError);
    expect(() => computeSheetLayout(0, 45, PAPER_4X6)).toThrow(LayoutError);
    expect(() => computeSheetLayout(35, -1, PAPER_A4)).toThrow(LayoutError);
  });

  it("mmToPt converts correctly", () => {
    expect(mmToPt(25.4)).toBeCloseTo(72, 6);
    expect(mmToPt(210)).toBeCloseTo(595.28, 1);
  });
});
