import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import { normalizeOsrm, parsePoint, routeCacheKey } from "@/lib/routing";

const osrm = JSON.parse(fs.readFileSync("fixtures/osrm-kl-ipoh.json", "utf8"));

describe("parsePoint", () => {
  it("accepts lat,lng inside Malaysia and rounds to 4 decimals", () => {
    expect(parsePoint("3.139012,101.686934")).toEqual({ lat: 3.139, lng: 101.6869 });
  });
  it("rejects junk, missing parts and places outside Malaysia", () => {
    for (const bad of [null, "", "abc", "3.1", "3.1,abc", "NaN,NaN", "51.5,-0.12", "3.1,101.6,5", "99,101"]) expect(parsePoint(bad)).toBeNull();
  });
});

describe("routeCacheKey", () => {
  it("is the same for nearly identical coordinates so repeat searches share one upstream call", () => {
    const a = parsePoint("3.13901,101.68691")!, b = parsePoint("3.13902,101.68692")!, c = parsePoint("4.5975,101.0901")!;
    expect(routeCacheKey(a, c)).toBe(routeCacheKey(b, c));
    expect(routeCacheKey(a, c)).not.toBe(routeCacheKey(c, a));
  });
});

describe("normalizeOsrm", () => {
  it("returns distance, duration and a lighter line that keeps both ends", () => {
    const routes = normalizeOsrm(osrm);
    expect(routes).toHaveLength(1);
    const r = routes[0];
    const original = osrm.routes[0].geometry.coordinates as number[][];
    expect(r.distance_m).toBeCloseTo(osrm.routes[0].distance, 0);
    expect(r.duration_s).toBeCloseTo(osrm.routes[0].duration, 0);
    expect(r.geometry.coordinates.length).toBeLessThan(original.length);
    expect(r.geometry.coordinates.length).toBeGreaterThan(40);
    expect(r.geometry.coordinates[0]).toEqual(original[0]);
    expect(r.geometry.coordinates.at(-1)).toEqual(original.at(-1));
  });

  it("keeps at most three alternatives and gives each a stable id", () => {
    const many = { code: "Ok", routes: [0, 1, 2, 3].map(() => osrm.routes[0]) };
    expect(normalizeOsrm(many).map((r) => r.id)).toEqual(["r0", "r1", "r2"]);
  });

  it("returns no routes for NoRoute and for malformed payloads", () => {
    expect(normalizeOsrm({ code: "NoRoute", routes: [] })).toEqual([]);
    expect(normalizeOsrm({ weird: 1 })).toEqual([]);
    expect(normalizeOsrm(null)).toEqual([]);
  });
});

describe("GET /api/route", () => {
  const from = "3.139,101.6869", to = "4.5975,101.0901";
  const url = (f: string | null, t: string | null) => `http://x/api/route?${f ? "from=" + f : ""}&${t ? "to=" + t : ""}`;
  let calls = 0;
  const upstream = (body: unknown, status = 200) => vi.fn(async () => { calls++; return new Response(JSON.stringify(body), { status }); });

  beforeEach(() => { calls = 0; vi.resetModules(); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it("400 for missing, malformed or out-of-Malaysia coordinates, without calling upstream", async () => {
    vi.stubGlobal("fetch", upstream(osrm));
    const { GET } = await import("@/app/api/route/route");
    for (const u of [url(null, to), url(from, null), url("x,y", to), url("51.5,-0.12", to)]) expect((await GET(new Request(u))).status).toBe(400);
    expect(calls).toBe(0);
  });

  it("returns normalized routes and caches repeat requests", async () => {
    vi.stubGlobal("fetch", upstream(osrm));
    const { GET } = await import("@/app/api/route/route");
    const first = await GET(new Request(url(from, to)));
    expect(first.status).toBe(200);
    const body = await first.json();
    expect(body.routes).toHaveLength(1);
    expect(body.routes[0].distance_m).toBeGreaterThan(190_000);
    expect(body.source).toMatch(/OSRM/);
    expect(typeof body.fetchedAt).toBe("string");
    await GET(new Request(url(from, to)));
    expect(calls).toBe(1);
  });

  it("503 with no fake route when the upstream is down", async () => {
    vi.stubGlobal("fetch", upstream({ message: "boom" }, 500));
    const { GET } = await import("@/app/api/route/route");
    const res = await GET(new Request(url(from, to)));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "unavailable" });
  });

  it("404 no-route when the places cannot be joined by road", async () => {
    vi.stubGlobal("fetch", upstream({ code: "NoRoute", routes: [] }));
    const { GET } = await import("@/app/api/route/route");
    const res = await GET(new Request(url(from, "5.9804,116.0735")));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "no-route" });
  });

  it("429 once the per-instance cap is reached, so a viral spike cannot run up the bill", async () => {
    vi.stubGlobal("fetch", upstream(osrm));
    const { GET } = await import("@/app/api/route/route");
    let last = 200;
    for (let i = 0; i < 70; i++) last = (await GET(new Request(url(`3.${1000 + i},101.6869`, to)))).status;
    expect(last).toBe(429);
    expect(calls).toBeLessThanOrEqual(60);
  });
});
