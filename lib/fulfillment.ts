/**
 * Fulfillment: runs once an order is marked paid. Generates deliverables from
 * the CLEAN processed asset for the primary spec AND every add-on spec bought
 * at checkout, stores them, emails signed per-spec download links.
 * Idempotent — safe to call again from a retried webhook.
 *
 * Add-on specs each have their own aspect ratio / head-eye geometry, so the
 * primary clean asset can't be reused for them. Fulfillment re-runs the pipeline
 * from the stored ORIGINAL using the landmarks persisted at process time.
 *
 * Cost note: re-running the pipeline re-invokes background removal per add-on
 * spec (a paid Replicate call). This is the correctness-first choice; caching
 * the alpha cutout at process time to reuse across specs is a future
 * optimization (documented in AUDIT_LOG.md, deferred — cost is bounded by the
 * add-on count the customer explicitly paid for).
 */

import sharp from "sharp";
import { env } from "@/lib/env";
import { getSpecOrThrow, type PhotoSpec } from "@/data/photo-specs";
import { getStorage } from "@/lib/providers/storage";
import { getOrderStore, type Order } from "@/lib/orders";
import { getEmailProvider } from "@/lib/providers/email";
import { makeHiRes, makePrintSheetPdf, PRINT_PAPERS } from "@/lib/deliverables";
import { processPhoto } from "@/lib/pipeline";
import { downloadUrl } from "@/lib/sign";

/** Ordered, de-duplicated list of every spec a paid order is entitled to. */
export function orderSpecIds(order: Order): string[] {
  return [...new Set([order.specId, ...order.addonSpecIds])];
}

/** Storage key for the clean, exact-spec processed photo of a given spec. */
function processedKeyFor(orderId: string, specId: string): string {
  return `${orderId}/processed-${specId}.png`;
}

/**
 * Ensure the clean processed asset exists for `spec`. For the primary spec this
 * is the asset produced at /api/process time; for an add-on spec it's generated
 * on demand by re-running the pipeline from the stored original + landmarks.
 */
async function cleanBytesForSpec(order: Order, spec: PhotoSpec): Promise<Buffer | null> {
  const storage = getStorage();
  const key = processedKeyFor(order.id, spec.id);

  const existing = await storage.get(key);
  if (existing) return existing;

  // Add-on spec: re-crop the original. Needs the persisted landmarks + original.
  if (!order.originalKey || !order.landmarks) return null;
  const original = await storage.get(order.originalKey);
  if (!original) return null;

  const meta = await sharp(original).metadata();
  if (!meta.width || !meta.height) return null;

  const processed = await processPhoto({
    imageBytes: original,
    imageWidth: meta.width,
    imageHeight: meta.height,
    landmarks: order.landmarks,
    spec,
  });
  await storage.put(key, processed.bytes, "image/png");
  return processed.bytes;
}

/** Generate hi-res + print-sheet deliverables for one spec from its clean bytes. */
async function generateDeliverables(orderId: string, spec: PhotoSpec, clean: Buffer): Promise<void> {
  const storage = getStorage();
  const hires = await makeHiRes(clean, spec);
  await storage.put(`${orderId}/hires-${spec.id}.png`, hires, "image/png");

  try {
    const pdf46 = await makePrintSheetPdf(clean, spec, PRINT_PAPERS["4x6"]);
    await storage.put(`${orderId}/sheet-4x6-${spec.id}.pdf`, pdf46, "application/pdf");
  } catch {
    /* spec may not fit 4x6; A4 still generated */
  }
  const pdfA4 = await makePrintSheetPdf(clean, spec, PRINT_PAPERS.a4);
  await storage.put(`${orderId}/sheet-a4-${spec.id}.pdf`, pdfA4, "application/pdf");
}

export async function fulfillOrder(orderId: string): Promise<Order | null> {
  const store = getOrderStore();
  const order = await store.get(orderId);
  if (!order) return null;
  if (order.status !== "paid" && order.status !== "delivered") return order;
  if (order.status === "delivered" && order.printSheetKey) return order; // idempotent

  if (!order.processedKey) return order;

  const specIds = orderSpecIds(order);
  const specs = specIds.map((id) => getSpecOrThrow(id));

  // Generate every spec's deliverables (primary reuses its process-time asset;
  // add-ons are re-cropped from the original inside cleanBytesForSpec).
  for (const spec of specs) {
    const clean = await cleanBytesForSpec(order, spec);
    if (!clean) continue; // add-on missing original/landmarks — skip, primary still ships
    await generateDeliverables(order.id, spec, clean);
  }

  const primary = specs[0];
  const updated = await store.update(order.id, {
    status: "delivered",
    printSheetKey: `${order.id}/sheet-a4-${primary.id}.pdf`,
  });

  // Delivery email with signed, expiring, per-spec links (re-checked against
  // paid status at download time).
  if (order.email) {
    const email = getEmailProvider();
    const sections = specs
      .map((spec) => {
        const link = (kind: Parameters<typeof downloadUrl>[2]) =>
          downloadUrl(env.appUrl, order.id, kind, { specId: spec.id });
        return {
          spec,
          photo: link("photo"),
          hires: link("hires"),
          sheet4x6: link("sheet-4x6"),
          sheetA4: link("sheet-a4"),
        };
      });

    const text = sections
      .map(
        (s) =>
          `${s.spec.displayName}\n` +
          `  Photo: ${s.photo}\n  High-res: ${s.hires}\n` +
          `  Print sheet (4x6): ${s.sheet4x6}\n  Print sheet (A4): ${s.sheetA4}`
      )
      .join("\n\n");

    const html = sections
      .map(
        (s) =>
          `<p><strong>${s.spec.displayName}</strong></p><ul>` +
          `<li><a href="${s.photo}">Download photo</a></li>` +
          `<li><a href="${s.hires}">High-res (300dpi)</a></li>` +
          `<li><a href="${s.sheet4x6}">Print sheet · 4×6</a></li>` +
          `<li><a href="${s.sheetA4}">Print sheet · A4</a></li>` +
          `</ul>`
      )
      .join("");

    await email.send({
      to: order.email,
      subject:
        specs.length > 1
          ? `Your ${specs.length} VisaShot photos are ready`
          : `Your ${primary.displayName} is ready`,
      text: `Your VisaShot photo set is ready to download.\n\n${text}\n\nLinks expire in 7 days. Made with VisaShot.`,
      html: `<p>Your VisaShot photo set is ready.</p>${html}<p style="color:#8b93a7;font-size:12px">Links expire in 7 days. Made with VisaShot.</p>`,
    });
  }

  return updated ?? order;
}
