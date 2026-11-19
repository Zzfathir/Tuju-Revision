import { beforeEach, describe, expect, it, vi } from "vitest";

class Precondition extends Error {}
const files = new Map<string, { body: string; etag: number }>();
let conflictOnce = false;

vi.mock("@vercel/blob", () => ({
  BlobPreconditionFailedError: Precondition,
  get: async (path: string) => {
    const file = files.get(path);
    return file ? { stream: new Response(file.body).body, blob: { etag: String(file.etag) } } : null;
  },
  put: async (path: string, body: string, options: { ifMatch?: string; allowOverwrite?: boolean }) => {
    const file = files.get(path);
    if (conflictOnce && file) {
      // Simulate another tester saving between our read and write.
      conflictOnce = false;
      const other = JSON.parse(file.body);
      other.counts.visit = (other.counts.visit ?? 0) + 10;
      files.set(path, { body: JSON.stringify(other), etag: file.etag + 1 });
      throw new Precondition("stale");
    }
    if (file && (!options.allowOverwrite || options.ifMatch !== String(file.etag))) throw new Precondition("stale");
    files.set(path, { body, etag: (file?.etag ?? 0) + 1 });
  },
}));

describe("blob-backed tester counters", () => {
  beforeEach(() => { files.clear(); vi.resetModules(); vi.stubEnv("BLOB_READ_WRITE_TOKEN", "test"); });

  it("persists counts, unique sessions and feedback in the blob store", async () => {
    const counter = await import("@/lib/counter");
    await counter.record("visit", "abcdefgh1");
    await counter.record("visit", "abcdefgh1");
    await counter.record("visit", "abcdefgh2");
    await counter.addFeedback("  clear   flow ");
    // A fresh module instance (a different serverless lambda) sees the same data.
    vi.resetModules();
    const other = await import("@/lib/counter");
    const stats = await other.readStats();
    const visit = stats.rows.find((row) => row.event === "visit");
    expect(visit).toMatchObject({ count: 3, sessions: 2 });
    expect(stats.feedback[0].text).toBe("clear flow");
    expect(stats.durable).toBe(true);
  });

  it("retries on a concurrent write instead of losing the count", async () => {
    const counter = await import("@/lib/counter");
    await counter.record("plan_made");
    conflictOnce = true;
    await counter.record("plan_made");
    const stats = await counter.readStats();
    expect(stats.rows.find((row) => row.event === "plan_made")?.count).toBe(2);
    // The rival tester's write (+10 visits) survived our retry.
    expect(stats.rows.find((row) => row.event === "visit")?.count).toBe(10);
  });
  it("recovers from a corrupt or malformed counter blob instead of failing forever", async () => {
    for (const body of ["{not json", "null", '{"counts":[],"sessions":5,"feedback":"x"}']) {
      files.set("stats/counters.json", { body, etag: 7 });
      vi.resetModules();
      const counter = await import("@/lib/counter");
      await counter.record("share");
      const stats = await counter.readStats();
      expect(stats.rows.find((row) => row.event === "share")?.count).toBe(1);
      expect(stats.feedback).toEqual([]);
    }
  });
});
