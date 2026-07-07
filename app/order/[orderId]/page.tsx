import { notFound } from "next/navigation";
import Link from "next/link";
import { getOrderStore } from "@/lib/orders";
import { getSpec } from "@/data/photo-specs";
import { downloadUrl } from "@/lib/sign";
import { formatUsd } from "@/lib/pricing";
import { env } from "@/lib/env";
import { OrderSuccessClient } from "./OrderSuccessClient";

export const metadata = { title: "Your order" };

export default async function OrderPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const order = await getOrderStore().get(orderId);
  if (!order) notFound();

  const spec = getSpec(order.specId);
  if (!spec) notFound();

  if (order.status === "pending") {
    return (
      <div className="mx-auto max-w-xl px-4 sm:px-6 py-16 text-center">
        <h1 className="display text-2xl mb-3">Payment not yet confirmed</h1>
        <p className="text-ink-soft mb-6">
          If you just paid, this page will update within a few seconds — refresh
          to check again.
        </p>
        <Link href={`/checkout/${orderId}`} className="text-accent underline underline-offset-2">
          Back to checkout
        </Link>
      </div>
    );
  }

  const links = {
    photo: downloadUrl(env.appUrl, order.id, "photo"),
    hires: downloadUrl(env.appUrl, order.id, "hires"),
    sheet4x6: downloadUrl(env.appUrl, order.id, "sheet-4x6"),
    sheetA4: downloadUrl(env.appUrl, order.id, "sheet-a4"),
  };

  return (
    <div className="mx-auto max-w-xl px-4 sm:px-6 py-10 sm:py-16">
      <p className="font-mono text-xs uppercase tracking-widest text-pass mb-2">
        Payment confirmed
      </p>
      <h1 className="display text-3xl sm:text-4xl mb-2">Your {spec.displayName} is ready</h1>
      <p className="text-ink-soft mb-8">
        Order <span className="font-mono tnum">{order.id}</span> · {formatUsd(order.amountCents)}
        {order.email ? <> · sent to {order.email}</> : null}
      </p>

      <div className="rounded-card border border-rule bg-paper p-5 space-y-3">
        <DownloadRow href={links.photo} kind="photo" label="Photo (exact spec size)" />
        <DownloadRow href={links.hires} kind="hires" label="High-res (300dpi)" />
        <DownloadRow href={links.sheet4x6} kind="sheet-4x6" label="Print sheet — 4×6 in" />
        <DownloadRow href={links.sheetA4} kind="sheet-a4" label="Print sheet — A4" />
      </div>

      <p className="mt-4 text-sm text-ink-faint">
        Links expire in 7 days and only work while this order is marked paid.
        Print at 100% scale (no &ldquo;fit to page&rdquo;) for correct physical size.
      </p>

      <OrderSuccessClient
        orderId={order.id}
        specId={spec.id}
        amountCents={order.amountCents}
        addonCount={order.addonSpecIds.length}
      />

      <div className="mt-10 rounded-card border border-rule p-5">
        <p className="font-medium text-ink mb-1">Need photos for family members?</p>
        <p className="text-sm text-ink-soft mb-3">
          Each additional person is a fresh photo, same session — $3.99.
        </p>
        <Link
          href="/create"
          className="inline-flex items-center h-10 px-5 rounded-md border border-rule-strong font-medium hover:border-ink-faint transition-colors"
        >
          Start another photo
        </Link>
      </div>
    </div>
  );
}

function DownloadRow({ href, kind, label }: { href: string; kind: string; label: string }) {
  return (
    <a
      href={href}
      data-download-kind={kind}
      className="flex items-center justify-between rounded-md border border-rule px-4 py-3 hover:border-rule-strong hover:bg-canvas transition-colors"
    >
      <span className="text-sm text-ink">{label}</span>
      <span className="text-accent text-sm font-medium">Download →</span>
    </a>
  );
}
