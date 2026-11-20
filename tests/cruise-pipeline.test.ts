import { describe, expect, it } from "vitest";
import * as turf from "@turf/turf";
import { getRoute } from "@/lib/data";
import { pointAt, routeLengthKm } from "@/lib/route";
import { bearingDiff, createPipeline, type Fix } from "@/lib/cruise/pipeline";
import { cruiseConfig } from "@/lib/cruise/config";

const { line } = getRoute("kl-ipoh");
const total = routeLengthKm(line);

const onRoute = (km: number, over: Partial<Fix> = {}): Fix => {
  const [lng, lat] = pointAt(line, km);
  return { t: km * 1000, lat, lng, speed: 25, heading: null, accuracy: 8, ...over };
};
/** A fix `metres` to the right of the route at `km`. */
const beside = (km: number, metres: number, over: Partial<Fix> = {}): Fix => {
  const here = pointAt(line, km), ahead = pointAt(line, km + 0.05);
  const bearing = turf.bearing(turf.point(here), turf.point(ahead));
  const [lng, lat] = turf.destination(turf.point(here), metres / 1000, bearing + 90, { units: "kilometers" }).geometry.coordinates;
  return { t: km * 1000, lat, lng, speed: 25, heading: null, accuracy: 8, ...over };
};

describe("bearingDiff", () => {
  it("is the smallest angle between two headings, wrapping at 360", () => {
    expect(bearingDiff(10, 350)).toBe(20);
    expect(bearingDiff(350, 10)).toBe(20);
    expect(bearingDiff(90, 270)).toBe(180);
    expect(bearingDiff(45, 45)).toBe(0);
  });
});

describe("createPipeline", () => {
  it("discards a fix that is less accurate than 50 m, and accepts one that is exactly 50 m", () => {
    const pipe = createPipeline(line, cruiseConfig);
    expect(pipe.push(onRoute(10, { accuracy: 51 }))).toBeNull();
    expect(pipe.push(onRoute(10, { accuracy: 50 }))).not.toBeNull();
    expect(pipe.push(onRoute(11, { accuracy: null }))).not.toBeNull(); // unknown accuracy is accepted
  });

  it("snaps to the route with km along that never goes backwards on a clean trace", () => {
    const pipe = createPipeline(line, cruiseConfig);
    let last = -1;
    // Mainline highway, fixes 30 m apart (about one a second at 100 km/h). Hairpin ramps are tested separately below.
    for (let km = 45; km <= 120; km += 0.03) {
      const snapped = pipe.push(onRoute(km))!;
      expect(snapped.km).toBeGreaterThanOrEqual(last);
      expect(snapped.offM).toBeLessThan(40); // smoothing lags a little through tight curves; the intent threshold is 60 m
      last = snapped.km;
    }
    expect(last).toBeGreaterThan(110);
  });

  it("a hairpin ramp can read far off the route for a moment, which is why OFF_ROUTE needs 10 sustained seconds", () => {
    const pipe = createPipeline(line, cruiseConfig);
    let worst = 0, worstKm = 0, run = 0, longestRun = 0;
    for (let km = 8; km <= 16; km += 0.03) { // the Sungai Buloh interchange: the route loops onto a ramp and back
      const snapped = pipe.push(onRoute(km))!;
      if (snapped.offM > worst) { worst = snapped.offM; worstKm = km; }
      run = snapped.offM > cruiseConfig.offRouteM ? run + 1 : 0;
      longestRun = Math.max(longestRun, run);
    }
    expect(worst).toBeGreaterThan(60); // documents the limitation: the filter cuts across the hairpin
    expect(worstKm).toBeGreaterThan(11);
    expect(longestRun).toBeLessThan(cruiseConfig.offRouteSeconds); // never long enough to count as off-route
  });

  it("reports how far off the route a fix is", () => {
    const pipe = createPipeline(line, { ...cruiseConfig, posAlpha: 1 }); // no smoothing so the offset is exact
    const snapped = pipe.push(beside(60, 100))!;
    expect(snapped.offM).toBeGreaterThan(90);
    expect(snapped.offM).toBeLessThan(110);
    expect(Math.abs(snapped.km - 60)).toBeLessThan(0.2);
  });

  it("smooths a jittery position toward the previous estimate (alpha 0.4)", () => {
    const pipe = createPipeline(line, cruiseConfig);
    const first = pipe.push(onRoute(30))!;
    const jumped = pipe.push(beside(30, 50, { t: 31_000 }))!;
    const raw = beside(30, 50);
    // The smoothed position sits between the old estimate and the raw jump, nearer the old one.
    const toOld = turf.distance(turf.point([jumped.lng, jumped.lat]), turf.point([first.lng, first.lat]), { units: "meters" });
    const toRaw = turf.distance(turf.point([jumped.lng, jumped.lat]), turf.point([raw.lng, raw.lat]), { units: "meters" });
    expect(toOld).toBeLessThan(toRaw);
    expect(toOld).toBeGreaterThan(5);
  });

  it("smooths speed (alpha 0.3) and treats a missing speed as the last known one", () => {
    const pipe = createPipeline(line, cruiseConfig);
    expect(pipe.push(onRoute(10, { speed: 20 }))!.speed).toBeCloseTo(20, 5);
    expect(pipe.push(onRoute(10.03, { speed: 30 }))!.speed).toBeCloseTo(0.3 * 30 + 0.7 * 20, 5);
    const kept = pipe.push(onRoute(10.06, { speed: null }))!.speed;
    expect(kept).toBeGreaterThan(20);
  });

  it("uses the GPS heading when moving, and the route bearing when stationary or heading is missing", () => {
    const pipe = createPipeline(line, cruiseConfig);
    const moving = pipe.push(onRoute(20, { speed: 20, heading: 123 }))!;
    expect(moving.heading).toBe(123);
    const stopped = createPipeline(line, cruiseConfig).push(onRoute(20, { speed: 0.5, heading: 123 }))!;
    expect(stopped.heading).toBeCloseTo(stopped.routeBearing, 5);
    const missing = createPipeline(line, cruiseConfig).push(onRoute(20, { speed: 20, heading: null }))!;
    expect(missing.heading).toBeCloseTo(missing.routeBearing, 5);
  });

  it("gives a route bearing in 0 to 360 that matches the direction of travel", () => {
    const snapped = createPipeline(line, cruiseConfig).push(onRoute(50))!;
    expect(snapped.routeBearing).toBeGreaterThanOrEqual(0);
    expect(snapped.routeBearing).toBeLessThan(360);
    const expected = (turf.bearing(turf.point(pointAt(line, 49.9)), turf.point(pointAt(line, 50.1))) + 360) % 360;
    expect(bearingDiff(snapped.routeBearing, expected)).toBeLessThan(12);
  });

  it("reports the remaining route length", () => {
    const snapped = createPipeline(line, cruiseConfig).push(onRoute(total - 3))!;
    expect(snapped.remainingKm).toBeGreaterThan(2.7);
    expect(snapped.remainingKm).toBeLessThan(3.3);
  });
});
