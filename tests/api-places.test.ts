import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const photonBody = {
  type: "FeatureCollection",
  features: [{
    type: "Feature",
    properties: { osm_id: 18225051, osm_type: "R", name: "Ipoh", state: "Perak", country: "Malaysia", countrycode: "MY" },
    geometry: { type: "Point", coordinates: [101.0901, 4.5975] },
  }],
};

describe("GET /api/places", () => {
  let calls = 0;
  let lastUrl = "";
  const upstream = (body: unknown, status = 200) => vi.fn(async (input: unknown) => { calls++; lastUrl = String(input); return new Response(JSON.stringify(body), { status }); });

  beforeEach(() => { calls = 0; lastUrl = ""; vi.resetModules(); });
  afterEach(() => { vi.unstubAllGlobals(); });

  const get = async (q: string | null) => {
    const { GET } = await import("@/app/api/places/route");
    return GET(new Request("http://x/api/places" + (q === null ? "" : "?q=" + encodeURIComponent(q))));
  };

  it("400 for a missing, too short or too long query, without calling upstream", async () => {
    vi.stubGlobal("fetch", upstream(photonBody));
    for (const q of [null, "", "a", "x".repeat(61)]) expect((await get(q)).status).toBe(400);
    expect(calls).toBe(0);
  });

  it("returns normalized Malaysian places and asks Photon for Malaysia only", async () => {
    vi.stubGlobal("fetch", upstream(photonBody));
    const res = await get("Ipoh");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.places[0]).toMatchObject({ name: "Ipoh", detail: "Perak", lat: 4.5975, lng: 101.0901 });
    expect(body.source).toMatch(/Photon/);
    expect(lastUrl).toContain("bbox=");
    expect(lastUrl).toContain("q=Ipoh");
  });

  it("caches repeat searches, ignoring case and spacing", async () => {
    vi.stubGlobal("fetch", upstream(photonBody));
    await get("Ipoh");
    await get("  ipoh ");
    expect(calls).toBe(1);
  });

  it("falls back to the labelled approximate list when Photon is down, so search never dies", async () => {
    vi.stubGlobal("fetch", upstream({ message: "boom" }, 500));
    const res = await get("ipo");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.source).toMatch(/approximate/i);
    expect(body.places[0]).toMatchObject({ name: "Ipoh", approximate: true });
  });

  it("falls back when Photon answers but has nothing in Malaysia", async () => {
    vi.stubGlobal("fetch", upstream({ type: "FeatureCollection", features: [] }));
    const body = await (await get("kuching")).json();
    expect(body.places[0].name).toBe("Kuching");
    expect(body.source).toMatch(/approximate/i);
  });
});
