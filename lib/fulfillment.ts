/**
 * Fulfillment: runs once an order is marked paid. Generates deliverables from
 * the CLEAN processed asset, stores them, emails signed download links.
 * Idempotent — safe to call again from a retried webhook.
 */

import { env } from "@/lib/env";
import { getSpecOrThrow } from "@/data/photo-specs";
import { getStorage } from "@/lib/providers/storage";
import { getOrderStore, type Order } from "@/lib/orders";
import { getEmailProvider } from "@/lib/providers/email";
import { makeHiRes, makePrintSheetPdf, PRINT_PAPERS } from "@/lib/deliverables";
import { downloadUrl } from "@/lib/sign";

export async function fulfillOrder(orderId: string): Promise<Order | null> {
  const store = getOrderStore();
  const storage = getStorage();
  const order = await store.get(orderId);
  if (!order) return null;
  if (order.status !== "paid" && order.status !== "delivered") return order;
  if (order.status === "delivered" && order.printSheetKey) return order; // idempotent

  const spec = getSpecOrThrow(order.specId);
  if (!order.processedKey) return order;
  const clean = await storage.get(order.processedKey);
  if (!clean) return order;

  const hiresKey = `${order.id}/hires-${spec.id}.png`;
  const sheet46Key = `${order.id}/sheet-4x6-${spec.id}.pdf`;
  const sheetA4Key = `${order.id}/sheet-a4-${spec.id}.pdf`;

  const hires = await makeHiRes(clean, spec);
  await storage.put(hiresKey, hires, "image/png");

  try {
    const pdf46 = await makePrintSheetPdf(clean, spec, PRINT_PAPERS["4x6"]);
    await storage.put(sheet46Key, pdf46, "application/pdf");
  } catch {
    /* spec may not fit 4x6; A4 still generated */
  }
  const pdfA4 = await makePrintSheetPdf(clean, spec, PRINT_PAPERS.a4);
  await storage.put(sheetA4Key, pdfA4, "application/pdf");

  const updated = await store.update(order.id, {
    status: "delivered",
    printSheetKey: sheetA4Key,
  });

  // Delivery email with signed, expiring links (re-checked against paid status
  // at download time).
  if (order.email) {
    const links = {
      photo: downloadUrl(env.appUrl, order.id, "photo"),
      hires: downloadUrl(env.appUrl, order.id, "hires"),
      sheet4x6: downloadUrl(env.appUrl, order.id, "sheet-4x6"),
      sheetA4: downloadUrl(env.appUrl, order.id, "sheet-a4"),
    };
    const email = getEmailProvider();
    await email.send({
      to: order.email,
      subject: `Your ${spec.displayName} is ready`,
      text:
        `Your ${spec.displayName} is ready to download.\n\n` +
        `Photo: ${links.photo}\nHigh-res: ${links.hires}\n` +
        `Print sheet (4x6): ${links.sheet4x6}\nPrint sheet (A4): ${links.sheetA4}\n\n` +
        `Links expire in 7 days. Made with VisaShot.`,
      html:
        `<p>Your <strong>${spec.displayName}</strong> is ready.</p>` +
        `<ul>` +
        `<li><a href="${links.photo}">Download photo</a></li>` +
        `<li><a href="${links.hires}">High-res (300dpi)</a></li>` +
        `<li><a href="${links.sheet4x6}">Print sheet · 4×6</a></li>` +
        `<li><a href="${links.sheetA4}">Print sheet · A4</a></li>` +
        `</ul><p style="color:#8b93a7;font-size:12px">Links expire in 7 days. Made with VisaShot.</p>`,
    });
  }

  return updated ?? order;
}
