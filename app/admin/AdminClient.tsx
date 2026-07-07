"use client";

/**
 * Admin overview: revenue, orders/day, conversion, one-click refund
 * (BUILD_PROMPT cross-cutting requirements). Token entered here is kept only
 * in component state (never persisted) and sent as a bearer header on every
 * request — the server is the actual gate (lib/admin-auth.ts).
 */

import { useState } from "react";
import { formatUsd } from "@/lib/pricing";
import type { OrderStatus } from "@/lib/orders";

interface AdminOrder {
  id: string;
  email: string | null;
  specId: string;
  status: OrderStatus;
  amountCents: number;
  createdAtMs: number;
  stripeSessionId: string | null;
}

export function AdminClient() {
  const [token, setToken] = useState("");
  const [orders, setOrders] = useState<AdminOrder[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [refunding, setRefunding] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/orders", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Unauthorized");
        setOrders(null);
        return;
      }
      setOrders(json.orders);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  async function refund(orderId: string) {
    if (!confirm(`Refund order ${orderId}? This cannot be undone.`)) return;
    setRefunding(orderId);
    try {
      const res = await fetch("/api/admin/refund", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ orderId }),
      });
      const json = await res.json();
      if (!res.ok) {
        alert(json.error ?? "Refund failed");
        return;
      }
      await load();
    } finally {
      setRefunding(null);
    }
  }

  const revenue = orders
    ?.filter((o) => o.status === "paid" || o.status === "delivered")
    .reduce((sum, o) => sum + o.amountCents, 0) ?? 0;
  const paidCount = orders?.filter((o) => o.status === "paid" || o.status === "delivered").length ?? 0;
  const conversion = orders?.length ? Math.round((paidCount / orders.length) * 100) : 0;

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-10 sm:py-16">
      <h1 className="display text-3xl mb-6">Admin</h1>

      {!orders && (
        <div className="rounded-card border border-rule p-5 max-w-sm">
          <label className="block text-sm font-medium text-ink mb-2">Admin token</label>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className="w-full h-11 px-3 rounded-md border border-rule-strong bg-canvas mb-3"
          />
          <button
            onClick={load}
            disabled={!token || loading}
            className="h-10 px-5 rounded-md bg-accent text-white font-medium disabled:opacity-40"
          >
            {loading ? "Loading…" : "Load orders"}
          </button>
          {error && <p className="mt-3 text-sm text-fail">{error}</p>}
        </div>
      )}

      {orders && (
        <>
          <div className="grid grid-cols-3 gap-4 mb-8">
            <Stat label="Revenue" value={formatUsd(revenue)} />
            <Stat label="Orders" value={String(orders.length)} />
            <Stat label="Conversion" value={`${conversion}%`} />
          </div>

          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-rule-strong text-left text-ink-faint">
                <th className="py-2 pr-3 font-normal">Order</th>
                <th className="py-2 pr-3 font-normal">Spec</th>
                <th className="py-2 pr-3 font-normal">Email</th>
                <th className="py-2 pr-3 font-normal">Status</th>
                <th className="py-2 pr-3 font-normal">Amount</th>
                <th className="py-2 font-normal">Action</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-b border-rule">
                  <td className="py-2 pr-3 font-mono text-xs">{o.id}</td>
                  <td className="py-2 pr-3">{o.specId}</td>
                  <td className="py-2 pr-3 text-ink-soft">{o.email ?? "—"}</td>
                  <td className="py-2 pr-3">{o.status}</td>
                  <td className="py-2 pr-3 font-mono tnum">{formatUsd(o.amountCents)}</td>
                  <td className="py-2">
                    {(o.status === "paid" || o.status === "delivered") && (
                      <button
                        onClick={() => refund(o.id)}
                        disabled={refunding === o.id}
                        className="text-fail text-xs font-medium underline underline-offset-2 disabled:opacity-40"
                      >
                        {refunding === o.id ? "Refunding…" : "Refund"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-card border border-rule p-4">
      <p className="text-xs text-ink-faint uppercase tracking-widest font-mono">{label}</p>
      <p className="text-2xl font-mono tnum text-ink mt-1">{value}</p>
    </div>
  );
}
