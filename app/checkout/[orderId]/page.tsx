import { getOrderStore } from "@/lib/orders";
import { getSpec, upsellSpecs } from "@/data/photo-specs";
import { notFound } from "next/navigation";
import { CheckoutClient } from "./CheckoutClient";

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const order = await getOrderStore().get(orderId);
  if (!order) notFound();

  const spec = getSpec(order.specId);
  if (!spec) notFound();

  if (order.status !== "pending") {
    return (
      <div className="mx-auto max-w-xl px-4 sm:px-6 py-16 text-center">
        <h1 className="display text-2xl mb-3">This order is already {order.status}</h1>
        <p className="text-ink-soft">
          {order.status === "paid" || order.status === "delivered"
            ? "Check your email for the download links, or view your order below."
            : "Start a new photo to place another order."}
        </p>
      </div>
    );
  }

  const addons = upsellSpecs(spec);

  return <CheckoutClient orderId={order.id} spec={spec} addons={addons} />;
}
