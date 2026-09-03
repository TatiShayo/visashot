/**
 * Object storage behind a typed interface.
 *
 * Real impl: Supabase Storage private bucket, short-lived signed URLs, 7-day
 * lifecycle purge (enforced by the purge cron + a bucket lifecycle rule).
 * Mock impl (no Supabase key): writes to a local .storage/ dir under the
 * OS temp area so the pipeline runs end-to-end in dev. NEVER served directly —
 * downloads always go through the signed /api/download route.
 *
 * All objects are PRIVATE by default (BUILD_PROMPT security model).
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

export const STORAGE_BUCKET = "visashot";
/** Retention window — matches the download-link TTL and the purge cron. */
export const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

export interface StoredObject {
  key: string;
  contentType: string;
  createdAtMs: number;
}

export interface StorageProvider {
  put(key: string, bytes: Buffer, contentType: string): Promise<StoredObject>;
  get(key: string): Promise<Buffer | null>;
  remove(key: string): Promise<void>;
  /** Objects older than the retention window — used by the purge cron. */
  listExpired(nowMs: number): Promise<string[]>;
  readonly mocked: boolean;
}

function safeKey(key: string): string {
  // Reject traversal; keys are always server-generated (order id + kind) but
  // defense-in-depth.
  if (key.includes("..") || key.startsWith("/") || key.includes("\\")) {
    throw new Error("Invalid storage key");
  }
  return key;
}

class LocalStorageProvider implements StorageProvider {
  readonly mocked = true;
  private root = path.join(os.tmpdir(), "visashot-storage");

  private full(key: string) {
    return path.join(this.root, safeKey(key));
  }

  async put(key: string, bytes: Buffer, contentType: string): Promise<StoredObject> {
    const f = this.full(key);
    await fs.mkdir(path.dirname(f), { recursive: true });
    await fs.writeFile(f, bytes);
    await fs.writeFile(`${f}.meta`, JSON.stringify({ contentType }), "utf8");
    return { key, contentType, createdAtMs: Date.now() };
  }

  async get(key: string): Promise<Buffer | null> {
    try {
      return await fs.readFile(this.full(key));
    } catch {
      return null;
    }
  }

  async remove(key: string): Promise<void> {
    const f = this.full(key);
    await fs.rm(f, { force: true });
    await fs.rm(`${f}.meta`, { force: true });
  }

  async listExpired(nowMs: number): Promise<string[]> {
    const out: string[] = [];
    async function walk(dir: string, rel: string) {
      let entries: import("node:fs").Dirent[];
      try {
        entries = await fs.readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const e of entries) {
        const abs = path.join(dir, e.name);
        const r = rel ? `${rel}/${e.name}` : e.name;
        if (e.isDirectory()) {
          await walk(abs, r);
        } else if (!e.name.endsWith(".meta")) {
          try {
            const st = await fs.stat(abs);
            if (nowMs - st.mtimeMs > RETENTION_MS) out.push(r.replace(/\\/g, "/"));
          } catch {
            // File might have been concurrently deleted or pruned
          }
        }
      }
    }
    await walk(this.root, "");
    return out;
  }
}

class SupabaseStorageProvider implements StorageProvider {
  readonly mocked = false;
  private client: SupabaseClient;

  constructor(url: string, serviceRoleKey: string) {
    this.client = createClient(url, serviceRoleKey, {
      auth: { persistSession: false },
    });
  }

  async put(key: string, bytes: Buffer, contentType: string): Promise<StoredObject> {
    const { error } = await this.client.storage
      .from(STORAGE_BUCKET)
      .upload(safeKey(key), bytes, { contentType, upsert: true });
    if (error) throw new Error(`Storage put failed: ${error.message}`);
    return { key, contentType, createdAtMs: Date.now() };
  }

  async get(key: string): Promise<Buffer | null> {
    const { data, error } = await this.client.storage
      .from(STORAGE_BUCKET)
      .download(safeKey(key));
    if (error || !data) return null;
    return Buffer.from(await data.arrayBuffer());
  }

  async remove(key: string): Promise<void> {
    await this.client.storage.from(STORAGE_BUCKET).remove([safeKey(key)]);
  }

  async listExpired(nowMs: number): Promise<string[]> {
    // Supabase Storage lifecycle rules purge at the bucket level; this listing
    // is the belt-and-braces cron pass. Lists top-level order folders.
    const expired: string[] = [];
    const { data: folders } = await this.client.storage
      .from(STORAGE_BUCKET)
      .list("", { limit: 1000 });
    for (const folder of folders ?? []) {
      const { data: files } = await this.client.storage
        .from(STORAGE_BUCKET)
        .list(folder.name, { limit: 1000 });
      for (const file of files ?? []) {
        const createdAt = file.created_at ? Date.parse(file.created_at) : 0;
        if (createdAt && nowMs - createdAt > RETENTION_MS) {
          expired.push(`${folder.name}/${file.name}`);
        }
      }
    }
    return expired;
  }
}

let cached: StorageProvider | null = null;

export function getStorage(): StorageProvider {
  if (cached) return cached;
  cached =
    env.supabaseUrl && env.supabaseServiceRoleKey
      ? new SupabaseStorageProvider(env.supabaseUrl, env.supabaseServiceRoleKey)
      : new LocalStorageProvider();
  return cached;
}
