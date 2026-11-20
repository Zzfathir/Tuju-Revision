import { describe, expect, it } from "vitest";
import { getRoute } from "@/lib/data";
import { buildTripRoute } from "@/lib/trip-route";
import { RnrFile, RouteConfig, TollFile } from "@/lib/schemas";
import { routeLengthKm } from "@/lib/route";
import type { RouteOption } from "@/lib/routing";
import type { Place } from "@/lib/places";

const curated = getRoute("kl-ipoh");
const kl: Place = { id: "kl", name: "Kuala Lumpur", detail: "WP", lat: 3.139, lng: 101.6869 };
const ipoh: Place = { id: "ipoh", name: "Ipoh", detail: "Perak", lat: 4.5975, lng: 101.0901 };
const johor: Place = { id: "jb", name: "Johor Bahru", detail: "Johor", lat: 1.4927, lng: 103.7414 };
const muar: Place = { id: "muar", name: "Muar", detail: "Johor", lat: 2.0442, lng: 102.5689 };

const optionFrom = (coordinates: number[][], duration_s = 9000): RouteOption => ({ id: "r0", distance_m: 100_000, duration_s, geometry: { type: "LineString", coordinates } });
const build = (from: Place, to: Place, option: RouteOption) =>
  buildTripRoute({ from, to, option, source: "OSRM public demo", fetchedAt: "2026-11-21T01:00:00.000Z", curated });

describe("buildTripRoute", () => {
  it("on the curated corridor: verified stops, plazas, corridor weather and prayer zones switch on", () => {
    const trip = build(kl, ipoh, optionFrom(curated.line.geometry.coordinates, 8500));
    expect(trip.curated).toBe(true);
    expect(trip.corridorWeather).toBe(true);
    expect(trip.hasVerifiedStops).toBe(true);
    expect(trip.rnr.items).toHaveLength(curated.rnr.items.length);
    expect(trip.tolls.plazas).toHaveLength(curated.tolls.plazas.length);
    expect(trip.config.prayerZones).toEqual(curated.config.prayerZones);
    expect(trip.config.name.en).toBe("Kuala Lumpur → Ipoh");
    expect(trip.config.highway).toBe(curated.config.highway);
  });

  it("elsewhere: no invented stops, tolls, weather corridor or prayer zones; plain label", () => {
    const trip = build(johor, muar, optionFrom([[103.7414, 1.4927], [103.2, 1.8], [102.5689, 2.0442]], 7000));
    expect(trip.curated).toBe(false);
    expect(trip.corridorWeather).toBe(false);
    expect(trip.hasVerifiedStops).toBe(false);
    expect(trip.rnr.items).toEqual([]);
    expect(trip.tolls.plazas).toEqual([]);
    expect(trip.config.prayerZones).toEqual([]);
    expect(trip.config.weatherLocations).toEqual([]);
    expect(trip.config.highway).toBe("Driving route");
    expect(trip.config.name.en).toBe("Johor Bahru → Muar");
  });

  it("carries the route's own length and drive time, with provenance on the line", () => {
    const option = optionFrom([[103.7414, 1.4927], [102.5689, 2.0442]], 7000);
    const trip = build(johor, muar, option);
    expect(trip.routeKm).toBeCloseTo(routeLengthKm(trip.line), 5);
    expect(trip.line.properties?.duration_s_freeflow).toBe(7000);
    expect(trip.line.properties?.retrieved_at).toBe("2026-11-21T01:00:00.000Z");
    expect(String(trip.line.properties?.source)).toMatch(/OSRM/);
  });

  it("never labels an OSRM-derived line as verified, and says how the toll plazas were matched", () => {
    const trip = build(kl, ipoh, optionFrom(curated.line.geometry.coordinates));
    expect(trip.line.properties?.verified).toBe(false);
    expect(trip.tolls.note).toMatch(/matched to this route automatically/i);
    expect(trip.tolls.fares["plaza-tol-jalan-duta"]["plaza-tol-simpang-pulai"]).toBe(20.34); // real fares stay
  });

  it("produces data that passes the same schemas the curated files do", () => {
    for (const trip of [build(kl, ipoh, optionFrom(curated.line.geometry.coordinates)), build(johor, muar, optionFrom([[103.7, 1.49], [102.5, 2.0]]))]) {
      expect(() => RouteConfig.parse(trip.config)).not.toThrow();
      expect(() => RnrFile.parse(trip.rnr)).not.toThrow();
      expect(() => TollFile.parse(trip.tolls)).not.toThrow();
    }
  });

  it("gives different trips different keys so the planner resets cleanly", () => {
    const a = build(kl, ipoh, optionFrom(curated.line.geometry.coordinates));
    const b = build(johor, muar, optionFrom([[103.7, 1.49], [102.5, 2.0]]));
    expect(a.key).not.toBe(b.key);
  });
});
