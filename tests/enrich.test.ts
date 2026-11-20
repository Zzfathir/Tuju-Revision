import { describe, expect, it } from "vitest";
import * as turf from "@turf/turf";
import { getRoute } from "@/lib/data";
import { enrichRoute, overlapShare } from "@/lib/enrich";
import { routeLengthKm, type RouteLine } from "@/lib/route";
import { quoteToll } from "@/lib/tolls";

const r = getRoute("kl-ipoh");
const curated = { rnr: r.rnr, tolls: r.tolls, line: r.line };
const reversed: RouteLine = { ...r.line, geometry: { type: "LineString", coordinates: [...r.line.geometry.coordinates].reverse() } };
const slice = (from: number, to: number): RouteLine => turf.lineSliceAlong(r.line, from, to, { units: "kilometers" }) as RouteLine;
const shifted = (dLat: number): RouteLine => ({ ...r.line, geometry: { type: "LineString", coordinates: r.line.geometry.coordinates.map(([x, y]) => [x, y + dLat]) } });

describe("enrichRoute", () => {
  it("on the curated corridor itself, keeps every stop and plaza with the same distances", () => {
    const { stops, tolls } = enrichRoute(r.line, curated);
    expect(stops.map((s) => s.id)).toEqual(r.rnr.items.map((s) => s.id));
    stops.forEach((s, i) => expect(Math.abs(s.distanceAlongRoute_km - r.rnr.items[i].distanceAlongRoute_km)).toBeLessThan(0.3));
    expect(tolls.plazas).toHaveLength(r.tolls.plazas.length);
    expect(quoteToll(tolls, "plaza-tol-jalan-duta", "plaza-tol-simpang-pulai")).toMatchObject({ ok: true, fare: 20.34 });
  });

  it("travelling the other way drops northbound-only stops, keeps plazas in the new order, and invents no fare", () => {
    const { stops, tolls } = enrichRoute(reversed, curated);
    expect(stops).toEqual([]);
    expect(tolls.plazas).toHaveLength(r.tolls.plazas.length);
    expect(tolls.plazas[0].id).toBe("plaza-tol-simpang-pulai");
    const quote = quoteToll(tolls, "plaza-tol-simpang-pulai", "plaza-tol-jalan-duta");
    expect(quote.ok).toBe(false);
    if (!quote.ok) expect(quote.reason).toBe("unknown-fare");
  });

  it("a route that only partly follows the corridor gets just the stops and plazas on it, re-based to its own start", () => {
    const part = slice(20, 150);
    const { stops, tolls } = enrichRoute(part, curated);
    const original = r.rnr.items.filter((s) => s.distanceAlongRoute_km > 22 && s.distanceAlongRoute_km < 148);
    expect(stops.map((s) => s.id)).toEqual(original.map((s) => s.id));
    stops.forEach((s, i) => expect(Math.abs(s.distanceAlongRoute_km - (original[i].distanceAlongRoute_km - 20))).toBeLessThan(0.4));
    expect(tolls.plazas.length).toBeGreaterThan(0);
    expect(tolls.plazas.length).toBeLessThan(r.tolls.plazas.length);
    expect(tolls.plazas.every((p) => p.distanceAlongRoute_km >= -0.5 && p.distanceAlongRoute_km <= routeLengthKm(part) + 0.5)).toBe(true);
  });

  it("gets nothing on roads elsewhere or merely near", () => {
    const johor: RouteLine = { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [[103.74, 1.49], [103.5, 2.0], [103.1, 2.5]] } };
    expect(enrichRoute(johor, curated)).toMatchObject({ stops: [], tolls: { plazas: [] } });
    const parallel = enrichRoute(turf.lineOffset(r.line, 1.5, { units: "kilometers" }) as RouteLine, curated); // a true parallel road 1.5 km away
    expect(parallel.stops).toEqual([]);
    expect(parallel.tolls.plazas).toEqual([]);
  });

  it("a road running just beside the highway is not the highway: no tolls and no stops from it", () => {
    const beside = enrichRoute(turf.lineOffset(r.line, 0.3, { units: "kilometers" }) as RouteLine, curated); // 300 m away
    expect(beside.stops).toEqual([]);
    expect(beside.tolls.plazas).toEqual([]);
  });

  it("judges a long straight segment along its whole length, not by one point", () => {
    const coords = r.line.geometry.coordinates;
    const chord = turf.lineString([coords[0], coords[coords.length - 1]]) as RouteLine;
    const length = routeLengthKm(chord);
    let near = 0, count = 0;
    for (let km = 0; km <= length; km += 5) { // independent, slower measurement with turf
      const spot = turf.nearestPointOnLine(r.line, turf.along(chord, km, { units: "kilometers" }), { units: "kilometers" });
      if ((spot.properties.dist as number) * 1000 <= 600) near++;
      count++;
    }
    const truth = near / count;
    expect(truth).toBeGreaterThan(0.05); // fractional, so an all-or-nothing answer would be wrong
    expect(truth).toBeLessThan(0.95);
    expect(Math.abs(overlapShare(chord, r.line) - truth)).toBeLessThan(0.08);
  });

  it("never mutates the curated data", () => {
    const before = JSON.stringify(curated);
    enrichRoute(slice(20, 150), curated);
    expect(JSON.stringify(curated)).toBe(before);
  });
});

describe("overlapShare", () => {
  it("is about 1 on the corridor, 0 elsewhere, and in between for a partial match", () => {
    expect(overlapShare(r.line, r.line)).toBeGreaterThan(0.97);
    expect(overlapShare(shifted(0.5), r.line)).toBe(0);
    const longer = turf.lineString([...r.line.geometry.coordinates, [100.5, 5.0], [100.3, 5.4]]) as RouteLine;
    const share = overlapShare(longer, r.line);
    expect(share).toBeGreaterThan(0.4);
    expect(share).toBeLessThan(0.95);
  });
});
