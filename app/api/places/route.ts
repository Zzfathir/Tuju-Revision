import { NextResponse } from "next/server";
import { z } from "zod";
import { cachedFetch, cdnHeaders } from "@/lib/cache";
import { makeLimiter } from "@/lib/limiter";
import { normalizePhoton, searchFallback } from "@/lib/places";

export const dynamic = "force-dynamic";
const TTL = 24 * 3600_000;
const PhotonResponse = z.object({ features: z.array(z.unknown()) }).passthrough();
// Photon is a free, shared service with a fair-use policy: about one call a second, capped per minute, per instance.
const limiter = makeLimiter({ max: 30, perMs: 60_000 });
let nextSlot = 0;
class RateLimited extends Error {}

async function gate() {
  if (!limiter.take()) throw new RateLimited();
  const now = Date.now();
  const wait = Math.max(0, nextSlot - now);
  if (wait > 3000) throw new RateLimited(); // do not queue a pile-up behind a spike
  nextSlot = Math.max(now, nextSlot) + 1100;
  if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
}

export async function GET(req: Request) {
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().replace(/\s+/g, " ");
  if (q.length < 2 || q.length > 60) return NextResponse.json({ error: "invalid-query" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=8&lang=en&bbox=99.4,0.8,119.5,7.5`;
  try {
    const result = await cachedFetch({ key: "places:" + q.toLowerCase(), url, ttlMs: TTL, schema: PhotonResponse, beforeFetch: gate, timeoutMs: 4000 });
    const places = normalizePhoton(result.data);
    if (places.length) {
      return NextResponse.json({ places, source: "Photon / OpenStreetMap", status: result.status, fetchedAt: result.fetchedAt }, { headers: cdnHeaders(3600) });
    }
  } catch {
    // Live search failed or was capped: fall through to the labelled approximate list so search never dies.
  }
  return NextResponse.json(
    { places: searchFallback(q), source: "approximate city list (live search unavailable or no match)", status: "cached", fetchedAt: null },
    { headers: { "Cache-Control": "no-store" } },
  );
}
