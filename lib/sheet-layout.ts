/**
 * Print-sheet layout math — pure, unit-tested. Given a photo's physical size
 * and a paper size, compute where to tile the photos (with cut guides) so a
 * print at 100% scale yields correctly-sized document photos.
 *
 * All units are millimeters.
 */

export interface PaperSize {
  id: "4x6" | "a4";
  widthMm: number;
  heightMm: number;
  displayName: string;
}

export const PAPER_4X6: PaperSize = {
  id: "4x6",
  widthMm: 152.4,
  heightMm: 101.6,
  displayName: '4 × 6 in (10 × 15 cm)',
};

export const PAPER_A4: PaperSize = {
  id: "a4",
  widthMm: 210,
  heightMm: 297,
  displayName: "A4",
};

/** Printers can't reach the paper edge; keep everything inside this margin. */
export const SHEET_MARGIN_MM = 6;
/** Gap between photos — room for scissors + cut guides. */
export const PHOTO_GAP_MM = 4;

export interface PlacedPhoto {
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
}

export interface SheetLayout {
  paper: PaperSize;
  columns: number;
  rows: number;
  photos: PlacedPhoto[];
  /** X positions (mm) for vertical cut-guide lines, including outer edges. */
  cutXs: number[];
  /** Y positions (mm) for horizontal cut-guide lines. */
  cutYs: number[];
}

export class LayoutError extends Error {}

/**
 * Tile as many photos as fit (capped), centered on the page as a block.
 * Tries both paper orientations and keeps the one that fits more photos
 * (e.g. 35×45 mm photos fit 4-up on a 4×6 held portrait, only 3 landscape).
 */
export function computeSheetLayout(
  photoWidthMm: number,
  photoHeightMm: number,
  paper: PaperSize,
  maxPhotos = 8
): SheetLayout {
  const rotated: PaperSize = {
    ...paper,
    widthMm: paper.heightMm,
    heightMm: paper.widthMm,
  };
  const a = layoutOnPaper(photoWidthMm, photoHeightMm, paper, maxPhotos);
  const b = layoutOnPaper(photoWidthMm, photoHeightMm, rotated, maxPhotos);
  if (a === null && b === null) {
    throw new LayoutError(
      `Photo ${photoWidthMm}×${photoHeightMm}mm does not fit on ${paper.displayName}`
    );
  }
  if (a === null) return b!;
  if (b === null) return a;
  return b.photos.length > a.photos.length ? b : a;
}

function layoutOnPaper(
  photoWidthMm: number,
  photoHeightMm: number,
  paper: PaperSize,
  maxPhotos: number
): SheetLayout | null {
  if (photoWidthMm <= 0 || photoHeightMm <= 0) {
    throw new LayoutError("Photo dimensions must be positive");
  }
  const usableW = paper.widthMm - 2 * SHEET_MARGIN_MM;
  const usableH = paper.heightMm - 2 * SHEET_MARGIN_MM;
  if (photoWidthMm > usableW || photoHeightMm > usableH) {
    throw new LayoutError(
      `Photo ${photoWidthMm}×${photoHeightMm}mm does not fit on ${paper.displayName}`
    );
  }

  const fit = (span: number, item: number) =>
    Math.max(1, Math.floor((span + PHOTO_GAP_MM) / (item + PHOTO_GAP_MM)));

  let columns = fit(usableW, photoWidthMm);
  let rows = fit(usableH, photoHeightMm);

  // Cap total count, trimming rows first (keeps a fuller top block).
  while (columns * rows > maxPhotos) {
    if (rows > 1) rows -= 1;
    else columns -= 1;
  }

  const blockW = columns * photoWidthMm + (columns - 1) * PHOTO_GAP_MM;
  const blockH = rows * photoHeightMm + (rows - 1) * PHOTO_GAP_MM;
  const originX = (paper.widthMm - blockW) / 2;
  const originY = (paper.heightMm - blockH) / 2;

  const photos: PlacedPhoto[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < columns; c++) {
      photos.push({
        xMm: originX + c * (photoWidthMm + PHOTO_GAP_MM),
        yMm: originY + r * (photoHeightMm + PHOTO_GAP_MM),
        widthMm: photoWidthMm,
        heightMm: photoHeightMm,
      });
    }
  }

  const cutXs: number[] = [];
  for (let c = 0; c < columns; c++) {
    const x = originX + c * (photoWidthMm + PHOTO_GAP_MM);
    cutXs.push(x, x + photoWidthMm);
  }
  const cutYs: number[] = [];
  for (let r = 0; r < rows; r++) {
    const y = originY + r * (photoHeightMm + PHOTO_GAP_MM);
    cutYs.push(y, y + photoHeightMm);
  }

  return { paper, columns, rows, photos, cutXs, cutYs };
}

/** mm → PDF points (1pt = 1/72 in). @react-pdf/renderer works in points. */
export const mmToPt = (mm: number) => (mm / 25.4) * 72;
