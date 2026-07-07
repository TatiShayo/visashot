/**
 * Order store behind a typed interface.
 *
 * Real impl: Supabase Postgres `orders` table (RLS default-deny; all access via
 * the service-role key in server routes only). Mock impl (no Supabase): an
 * in-process Map so the whole flow runs in dev. Order ids are nanoids — never
 * sequential (enumeration guard).
 *
 * The clean processed asset key is stored here but is NEVER handed to the
 * client before `status === "paid"` (see /api/download authorization).
 */

import { nanoid } from "nanoid";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

export type OrderStatus = "pending" | "paid" | "delivered";

export interface ComplianceReport {
  overall: "pass" | "warn" | "fail";
  checks: { id: string; status: "pass" | "warn" | "fail"; label: string; tip?: string }[];
  backgroundMocked: boolean;
}

export interface Order {
  id: string;
  email: string | null;
  specId: string;
  /** Additional specs bought as add-ons (each re-cropped). */
  addonSpecIds: string[];
  originalKey: string | null;
  /** Clean processed asset — gated behind paid status. */
  processedKey: string | null;
  watermarkedKey: string | null;
  printSheetKey: string | null;
  stripeSessionId: string | null;
  status: OrderStatus;
  complianceReport: ComplianceReport | null;
  amountCents: number;
  createdAtMs: number;
  paidAtMs: number | null;
  /** For abandoned-order recovery: whether the +4h email was sent. */
  recoveryEmailSent: boolean;
  /** Optional expiry date for the renewal-reminder loop. */
  docExpiryIso: string | null;
}

export interface CreateOrderInput {
  specId: string;
  email?: string | null;
  amountCents: number;
}

export interface OrderStore {
  create(input: CreateOrderInput): Promise<Order>;
  get(id: string): Promise<Order | null>;
  update(id: string, patch: Partial<Order>): Promise<Order | null>;
  findByStripeSession(sessionId: string): Promise<Order | null>;
  /** Pending orders older than `olderThanMs` with email + no recovery sent. */
  listAbandoned(olderThanMs: number, nowMs: number): Promise<Order[]>;
  readonly mocked: boolean;
}

export function newOrderId(): string {
  // URL-safe, non-sequential, collision-resistant.
  return nanoid(16);
}

function blankOrder(input: CreateOrderInput): Order {
  return {
    id: newOrderId(),
    email: input.email ?? null,
    specId: input.specId,
    addonSpecIds: [],
    originalKey: null,
    processedKey: null,
    watermarkedKey: null,
    printSheetKey: null,
    stripeSessionId: null,
    status: "pending",
    complianceReport: null,
    amountCents: input.amountCents,
    createdAtMs: Date.now(),
    paidAtMs: null,
    recoveryEmailSent: false,
    docExpiryIso: null,
  };
}

class MemoryOrderStore implements OrderStore {
  readonly mocked = true;
  private map = new Map<string, Order>();

  async create(input: CreateOrderInput): Promise<Order> {
    const o = blankOrder(input);
    this.map.set(o.id, o);
    return { ...o };
  }
  async get(id: string): Promise<Order | null> {
    const o = this.map.get(id);
    return o ? { ...o } : null;
  }
  async update(id: string, patch: Partial<Order>): Promise<Order | null> {
    const o = this.map.get(id);
    if (!o) return null;
    const next = { ...o, ...patch, id: o.id };
    this.map.set(id, next);
    return { ...next };
  }
  async findByStripeSession(sessionId: string): Promise<Order | null> {
    for (const o of this.map.values()) {
      if (o.stripeSessionId === sessionId) return { ...o };
    }
    return null;
  }
  async listAbandoned(olderThanMs: number, nowMs: number): Promise<Order[]> {
    const out: Order[] = [];
    for (const o of this.map.values()) {
      if (
        o.status === "pending" &&
        o.email &&
        !o.recoveryEmailSent &&
        nowMs - o.createdAtMs > olderThanMs
      ) {
        out.push({ ...o });
      }
    }
    return out;
  }
}

class SupabaseOrderStore implements OrderStore {
  readonly mocked = false;
  private client: SupabaseClient;
  private table = "orders";

  constructor(url: string, serviceRoleKey: string) {
    this.client = createClient(url, serviceRoleKey, {
      auth: { persistSession: false },
    });
  }

  async create(input: CreateOrderInput): Promise<Order> {
    const o = blankOrder(input);
    const { error } = await this.client.from(this.table).insert(this.toRow(o));
    if (error) throw new Error(`Order create failed: ${error.message}`);
    return o;
  }
  async get(id: string): Promise<Order | null> {
    const { data } = await this.client
      .from(this.table)
      .select("*")
      .eq("id", id)
      .maybeSingle();
    return data ? this.fromRow(data) : null;
  }
  async update(id: string, patch: Partial<Order>): Promise<Order | null> {
    const { data, error } = await this.client
      .from(this.table)
      .update(this.toRow(patch))
      .eq("id", id)
      .select("*")
      .maybeSingle();
    if (error) throw new Error(`Order update failed: ${error.message}`);
    return data ? this.fromRow(data) : null;
  }
  async findByStripeSession(sessionId: string): Promise<Order | null> {
    const { data } = await this.client
      .from(this.table)
      .select("*")
      .eq("stripe_session_id", sessionId)
      .maybeSingle();
    return data ? this.fromRow(data) : null;
  }
  async listAbandoned(olderThanMs: number, nowMs: number): Promise<Order[]> {
    const cutoff = new Date(nowMs - olderThanMs).toISOString();
    const { data } = await this.client
      .from(this.table)
      .select("*")
      .eq("status", "pending")
      .eq("recovery_email_sent", false)
      .not("email", "is", null)
      .lt("created_at", cutoff);
    return (data ?? []).map((r) => this.fromRow(r));
  }

  private toRow(o: Partial<Order>): Record<string, unknown> {
    const row: Record<string, unknown> = {};
    if (o.id !== undefined) row.id = o.id;
    if (o.email !== undefined) row.email = o.email;
    if (o.specId !== undefined) row.spec_id = o.specId;
    if (o.addonSpecIds !== undefined) row.addon_spec_ids = o.addonSpecIds;
    if (o.originalKey !== undefined) row.original_path = o.originalKey;
    if (o.processedKey !== undefined) row.processed_path = o.processedKey;
    if (o.watermarkedKey !== undefined) row.watermarked_path = o.watermarkedKey;
    if (o.printSheetKey !== undefined) row.print_sheet_path = o.printSheetKey;
    if (o.stripeSessionId !== undefined) row.stripe_session_id = o.stripeSessionId;
    if (o.status !== undefined) row.status = o.status;
    if (o.complianceReport !== undefined) row.compliance_report = o.complianceReport;
    if (o.amountCents !== undefined) row.amount_cents = o.amountCents;
    if (o.createdAtMs !== undefined) row.created_at = new Date(o.createdAtMs).toISOString();
    if (o.paidAtMs !== undefined)
      row.paid_at = o.paidAtMs ? new Date(o.paidAtMs).toISOString() : null;
    if (o.recoveryEmailSent !== undefined) row.recovery_email_sent = o.recoveryEmailSent;
    if (o.docExpiryIso !== undefined) row.doc_expiry = o.docExpiryIso;
    return row;
  }
  private fromRow(r: Record<string, unknown>): Order {
    return {
      id: String(r.id),
      email: (r.email as string) ?? null,
      specId: String(r.spec_id),
      addonSpecIds: (r.addon_spec_ids as string[]) ?? [],
      originalKey: (r.original_path as string) ?? null,
      processedKey: (r.processed_path as string) ?? null,
      watermarkedKey: (r.watermarked_path as string) ?? null,
      printSheetKey: (r.print_sheet_path as string) ?? null,
      stripeSessionId: (r.stripe_session_id as string) ?? null,
      status: (r.status as OrderStatus) ?? "pending",
      complianceReport: (r.compliance_report as ComplianceReport) ?? null,
      amountCents: Number(r.amount_cents ?? 0),
      createdAtMs: r.created_at ? Date.parse(String(r.created_at)) : Date.now(),
      paidAtMs: r.paid_at ? Date.parse(String(r.paid_at)) : null,
      recoveryEmailSent: Boolean(r.recovery_email_sent),
      docExpiryIso: (r.doc_expiry as string) ?? null,
    };
  }
}

let cached: OrderStore | null = null;

export function getOrderStore(): OrderStore {
  if (cached) return cached;
  cached =
    env.supabaseUrl && env.supabaseServiceRoleKey
      ? new SupabaseOrderStore(env.supabaseUrl, env.supabaseServiceRoleKey)
      : new MemoryOrderStore();
  return cached;
}

/** Test-only: reset the in-memory store between test files. */
export function __resetOrderStoreForTests() {
  cached = null;
}
