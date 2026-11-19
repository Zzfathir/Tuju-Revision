/**
 * Tiny server-side caching proxy helper (protects upstream APIs from viral load — the TuJu failure mode).
 * - in-memory TTL cache per serverless instance
 * - request coalescing (one upstream call in flight per key)
 * - last-good fallback (serve stale + mark "cached") then fixture fallback (mark "cached", fixture: true)
 * Upstream responses are zod-validated before they are cached.
 */
import type { ZodType } from "zod";

export type Fetched<T> = {
  data: T;
  status: "live" | "cached";
  fetchedAt: string; // when WE got it from upstream
  fixture?: boolean;
  error?: string;
};

type Entry = { value: Fetched<unknown>; expires: number };
const store = new Map<string, Entry>();
const inflight = new Map<string, Promise<Fetched<unknown>>>();

export async function cachedFetch<T>(opts: {
  key: string;
  url: string;
  ttlMs: number;
  schema: ZodType<T>;
  fixture: () => Promise<unknown>;
  fixtureFetchedAt?: string;
  timeoutMs?: number;
}): Promise<Fetched<T>> {
  const now = Date.now();
  const hit = store.get(opts.key);
  if (hit && hit.expires > now) return { ...(hit.value as Fetched<T>), status: hit.value.fixture ? "cached" : "live" };
  if (inflight.has(opts.key)) return inflight.get(opts.key) as Promise<Fetched<T>>;

  const p = (async (): Promise<Fetched<T>> => {
    try {
      const res = await fetch(opts.url, {
        headers: { "User-Agent": "jalan-pulang/0.1 (hackathon demo)", Accept: "application/json" },
        signal: AbortSignal.timeout(opts.timeoutMs ?? 6000),
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`upstream ${res.status}`);
      const parsed = opts.schema.safeParse(await res.json());
      if (!parsed.success) throw new Error("upstream payload failed validation");
      const value: Fetched<T> = { data: parsed.data, status: "live", fetchedAt: new Date().toISOString() };
      store.set(opts.key, { value, expires: Date.now() + opts.ttlMs });
      return value;
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      if (hit) return { ...(hit.value as Fetched<T>), status: "cached", error };
      const fx = opts.schema.parse(await opts.fixture());
      const value: Fetched<T> = { data: fx, status: "cached", fixture: true, fetchedAt: opts.fixtureFetchedAt ?? "unknown", error };
      // cache fixture briefly so a dead upstream isn't hammered
      store.set(opts.key, { value, expires: Date.now() + 60_000 });
      return value;
    } finally {
      inflight.delete(opts.key);
    }
  })();
  inflight.set(opts.key, p as Promise<Fetched<unknown>>);
  return p;
}

/** CDN cache header: browsers/CDN may reuse for `sMaxAge`, serve stale while revalidating. */
export const cdnHeaders = (sMaxAge: number) => ({
  "Cache-Control": `public, s-maxage=${sMaxAge}, stale-while-revalidate=${sMaxAge * 6}`,
});
