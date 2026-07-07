import { describe, it, expect } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { getStorage, RETENTION_MS } from "@/lib/providers/storage";

/**
 * SECURITY/PRIVACY REGRESSION (PLAYBOOK 2.7 + BUILD_PROMPT: "7-day auto-purge
 * cron is a compliance feature, not just cost control — verify it with a
 * test"). Uses the local filesystem storage provider (active in this test
 * environment — no Supabase configured) and backdates a file's mtime past the
 * retention window to prove `listExpired` finds it and `remove` deletes it,
 * without waiting 7 real days.
 */

describe("storage purge — 7-day retention", () => {
  it("lists and removes objects older than the retention window, leaves fresh ones", async () => {
    const storage = getStorage();
    expect(storage.mocked).toBe(true); // sanity: local filesystem provider in test env

    const oldKey = `purge-test/${Date.now()}-old.png`;
    const freshKey = `purge-test/${Date.now()}-fresh.png`;

    await storage.put(oldKey, Buffer.from("old bytes"), "image/png");
    await storage.put(freshKey, Buffer.from("fresh bytes"), "image/png");

    // Backdate the "old" file's mtime to just past the retention window.
    const root = path.join(os.tmpdir(), "visashot-storage");
    const oldFilePath = path.join(root, oldKey);
    const backdated = new Date(Date.now() - RETENTION_MS - 60_000);
    await fs.utimes(oldFilePath, backdated, backdated);

    const expired = await storage.listExpired(Date.now());
    expect(expired).toContain(oldKey);
    expect(expired).not.toContain(freshKey);

    // Purge, then confirm the old object is actually gone and the fresh one survives.
    for (const key of expired.filter((k) => k === oldKey)) {
      await storage.remove(key);
    }
    expect(await storage.get(oldKey)).toBeNull();
    expect(await storage.get(freshKey)).not.toBeNull();

    // Cleanup the fresh test artifact so repeated runs don't accumulate files.
    await storage.remove(freshKey);
  });
});
