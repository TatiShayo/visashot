"use client";

/**
 * DEV-ONLY mock checkout page. Mirrors the shape of a real Stripe Checkout
 * redirect: shows the order, a "Pay" button, then posts to /api/mock-pay
 * (which the real Stripe flow replaces with the signed webhook) and redirects
 * to the success page — same contract, so swapping in real Stripe later is a
 * provider-file change only, not a UI rewrite.
 */

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export function MockPayClient() {
  const params = useSearchParams();
  const router = useRouter();
  const orderId = params.get("order");
  const [status, setStatus] = useState<"idle" | "paying" | "error">("idle");

  useEffect(() => {
    if (!orderId) router.replace("/");
  }, [orderId, router]);

  async function confirmPay() {
    if (!orderId) return;
    setStatus("paying");
    try {
      const res = await fetch("/api/mock-pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      if (!res.ok) {
        setStatus("error");
        return;
      }
      router.push(`/order/${orderId}`);
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 sm:px-6 py-16 text-center">
      <p className="font-mono text-xs uppercase tracking-widest text-warn mb-4">
        Dev mock checkout — no real charge
      </p>
      <h1 className="display text-2xl sm:text-3xl mb-4">Simulate payment</h1>
      <p className="text-ink-soft mb-8">
        Stripe is not configured for this environment. Clicking below marks the
        order as paid and runs fulfillment exactly like the real webhook would.
      </p>
      <button
        onClick={confirmPay}
        disabled={status === "paying"}
        className="h-12 px-8 rounded-md bg-accent text-white font-medium disabled:opacity-50 hover:bg-accent-hover transition-colors"
      >
        {status === "paying" ? "Confirming…" : "Confirm mock payment"}
      </button>
      {status === "error" && (
        <p className="mt-4 text-sm text-fail">Could not confirm payment — please retry.</p>
      )}
    </div>
  );
}
