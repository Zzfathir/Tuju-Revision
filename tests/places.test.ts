import { describe, expect, it, vi, beforeEach } from "vitest";
import { normalizePhoton, searchFallback, POPULAR } from "@/lib/places";

const photon = (features: unknown[]) => ({ type: "FeatureCollection", features });
const feature = (props: Record<string, unknown>, lng: number, lat: number) => ({
  type: "Feature", properties: props, geometry: { type: "Point", coordinates: [lng, lat] },
});

describe("normalizePhoton", () => {
  it("keeps Malaysian places and turns them into simple results", () => {
    const places = normalizePhoton(photon([
      feature({ osm_id: 1, osm_type: "R", name: "Ipoh", state: "Perak", country: "Malaysia", countrycode: "MY", type: "city" }, 101.0901, 4.5975),
      feature({ osm_id: 2, osm_type: "N", name: "Ipoh", state: "Texas", country: "United States", countrycode: "US", type: "city" }, -99, 31),
    ]));
    expect(places).toHaveLength(1);
    expect(places[0]).toMatchObject({ name: "Ipoh", detail: "Perak", lat: 4.5975, lng: 101.0901 });
  });

  it("builds a readable detail line from street, district and state without duplicates", () => {
    const [p] = normalizePhoton(photon([
      feature({ osm_id: 3, osm_type: "W", name: "Kawasan Rehat Tapah", street: "Lebuhraya Utara-Selatan", county: "Batang Padang", state: "Perak", countrycode: "MY" }, 101.29, 4.178),
    ]));
    expect(p.detail).toBe("Lebuhraya Utara-Selatan, Batang Padang, Perak");
  });

  it("drops features with no name or bad coordinates, and dedupes the same place", () => {
    const f = feature({ osm_id: 5, osm_type: "N", name: "Taiping", state: "Perak", countrycode: "MY" }, 100.74, 4.85);
    const places = normalizePhoton(photon([
      f, f,
      feature({ osm_type: "N", osm_id: 6, countrycode: "MY" }, 101, 4),
      feature({ osm_type: "N", osm_id: 7, name: "Nowhere", countrycode: "MY" }, NaN, 4),
    ]));
    expect(places.map((p) => p.name)).toEqual(["Taiping"]);
  });

  it("returns an empty list for a malformed payload instead of throwing", () => {
    expect(normalizePhoton({ nope: true })).toEqual([]);
    expect(normalizePhoton(null)).toEqual([]);
  });
});

describe("fallback list", () => {
  it("finds places by prefix and substring, ignoring case, and labels them approximate", () => {
    const results = searchFallback("ipo");
    expect(results[0].name).toBe("Ipoh");
    expect(results[0].approximate).toBe(true);
    expect(searchFallback("KUALA").map((p) => p.name)).toContain("Kuala Lumpur");
  });

  it("popular places are real drivable peninsular cities with sane coordinates", () => {
    expect(POPULAR.length).toBeGreaterThanOrEqual(8);
    for (const p of POPULAR) {
      expect(p.lat).toBeGreaterThan(0.8); expect(p.lat).toBeLessThan(7.5);
      expect(p.lng).toBeGreaterThan(99.4); expect(p.lng).toBeLessThan(105);
    }
  });
});
