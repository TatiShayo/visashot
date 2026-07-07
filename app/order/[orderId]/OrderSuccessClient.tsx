"use client";

/**
 * Client-side glue on the success page: fires `download_completed` /
 * `purchase_completed` analytics and `family_prompt_clicked`. Purchase
 * completion is captured here (client render of a paid order = confirmed
 * server-side by the page's own paid-status check) rather than trusting any
 * client-supplied amount — the revenue figure comes from the order the server
 * already loaded.
 */

import { useEffect } from "react";
import { track, identifyEmail } from "@/lib/analytics";

export function OrderSuccessClient({
  orderId,
  specId,
  amountCents,
  addonCount,
}: {
  orderId: string;
  specId: string;
  amountCents: number;
  addonCount: number;
}) {
  useEffect(() => {
    // Fire once per order per browser (idempotency guard against refresh).
    // The order was already loaded server-side with a confirmed paid status,
    // so amountCents here reflects the actual charge, not a client guess.
    const key = `visashot:purchased:${orderId}`;
    if (typeof window !== "undefined" && !sessionStorage.getItem(key)) {
      sessionStorage.setItem(key, "1");
      track("purchase_completed", {
        spec_id: specId,
        revenue_usd: amountCents / 100,
        addon_count: addonCount,
        bump_selected: false,
      });
    }

    const handler = (e: MouseEvent) => {
      const el = (e.target as HTMLElement).closest("[data-download-kind]");
      if (el) {
        track("download_completed", { spec_id: specId, kind: el.getAttribute("data-download-kind") ?? "" });
      }
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [orderId, specId, amountCents, addonCount]);

  return null;
}

export function identifyOnDelivery(email: string) {
  identifyEmail(email);
}
