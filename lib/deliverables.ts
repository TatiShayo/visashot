/**
 * Post-payment deliverable generation: the exact-px photo, a 300dpi hi-res
 * version, and print-sheet PDFs (4x6 + A4) with cut guides. Generated from the
 * CLEAN processed asset — only ever invoked after an order is marked paid.
 */

import React from "react";
import sharp from "sharp";
import { Document, Page, Image, View, renderToBuffer } from "@react-pdf/renderer";
import type { PhotoSpec } from "@/data/photo-specs";
import {
  computeSheetLayout,
  mmToPt,
  PAPER_4X6,
  PAPER_A4,
  type PaperSize,
} from "@/lib/sheet-layout";

/** Ensure the photo carries the spec's print density (300dpi hi-res copy). */
export async function makeHiRes(cleanBytes: Buffer, spec: PhotoSpec): Promise<Buffer> {
  return sharp(cleanBytes).withMetadata({ density: spec.dpi }).png().toBuffer();
}

/**
 * Render a print-sheet PDF tiling the photo at its physical size with cut
 * guides. `photoDataUri` is the clean photo as a data URI.
 */
export async function makePrintSheetPdf(
  photoPngBytes: Buffer,
  spec: PhotoSpec,
  paper: PaperSize
): Promise<Buffer> {
  const layout = computeSheetLayout(spec.widthMm, spec.heightMm, paper);
  const dataUri = `data:image/png;base64,${photoPngBytes.toString("base64")}`;
  const pageWpt = mmToPt(layout.paper.widthMm);
  const pageHpt = mmToPt(layout.paper.heightMm);

  const photoEls = layout.photos.map((p, i) =>
    React.createElement(Image, {
      key: `p${i}`,
      src: dataUri,
      style: {
        position: "absolute",
        left: mmToPt(p.xMm),
        top: mmToPt(p.yMm),
        width: mmToPt(p.widthMm),
        height: mmToPt(p.heightMm),
      },
    })
  );

  // Cut guides: thin lines just outside the tiled block edges.
  const guideEls: React.ReactElement[] = [];
  const minX = layout.cutXs.length > 0 ? Math.min(...layout.cutXs) : 0;
  const maxX = layout.cutXs.length > 0 ? Math.max(...layout.cutXs) : layout.paper.widthMm;
  const minY = layout.cutYs.length > 0 ? Math.min(...layout.cutYs) : 0;
  const maxY = layout.cutYs.length > 0 ? Math.max(...layout.cutYs) : layout.paper.heightMm;
  for (const x of layout.cutXs) {
    guideEls.push(
      React.createElement(View, {
        key: `vx${x}`,
        style: {
          position: "absolute",
          left: mmToPt(x),
          top: mmToPt(minY) - 8,
          width: 0.5,
          height: mmToPt(maxY - minY) + 16,
          backgroundColor: "#c9cedb",
        },
      })
    );
  }
  for (const y of layout.cutYs) {
    guideEls.push(
      React.createElement(View, {
        key: `hy${y}`,
        style: {
          position: "absolute",
          left: mmToPt(minX) - 8,
          top: mmToPt(y),
          width: mmToPt(maxX - minX) + 16,
          height: 0.5,
          backgroundColor: "#c9cedb",
        },
      })
    );
  }

  const doc = React.createElement(
    Document,
    null,
    React.createElement(
      Page,
      { size: [pageWpt, pageHpt], style: { backgroundColor: "#ffffff" } },
      ...guideEls,
      ...photoEls
    )
  );

  return renderToBuffer(doc as Parameters<typeof renderToBuffer>[0]);
}

export const PRINT_PAPERS = { "4x6": PAPER_4X6, a4: PAPER_A4 };
