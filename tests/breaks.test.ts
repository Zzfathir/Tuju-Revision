import { describe, expect, it } from "vitest";
import { breakPlan, searchTerms, searchUrl } from "@/lib/breaks";
import { routeLengthKm, type RouteLine } from "@/lib/route";
import type { PlanInput } from "@/lib/planner";

// A straight line due north from 3.0 N; each 0.1 degree of latitude is about 11.1 km.
const lineOf = (degrees: number): RouteLine => ({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [[101.5, 3.0], [101.5, 3.0 + degrees]] } });
const input = (line: RouteLine, over: Partial<PlanInput> = {}): PlanInput => ({
  stops: [], routeKm: routeLengthKm(line), departureTime: new Date("2026-11-21T09:00:00+08:00"), avgSpeedKmh: 60,
  vehicleType: "petrol", needs: {}, prayerAware: false, maxDrivingMinutes: 120, dwellMinutes: 15, ...over,
});

describe("breakPlan", () => {
  it("a short trip needs no break and arrives on driving time alone", () => {
    const line = lineOf(0.9); // about 100 km
    const plan = breakPlan(input(line), line);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.stops).toEqual([]);
    expect(plan.totalMinutes).toBeCloseTo(routeLengthKm(line), 0);
  });

  it("spaces breaks so no leg is longer than the max drive, and adds dwell time", () => {
    const line = lineOf(1.8); // about 200 km at 60 km/h = 200 min
    const plan = breakPlan(input(line), line);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.stops).toHaveLength(1);
    const km = plan.stops.map((s) => s.stop.distanceAlongRoute_km);
    expect(km[0]).toBeGreaterThan(80);
    expect(km[0]).toBeLessThan(120);
    expect(plan.totalMinutes).toBeCloseTo(routeLengthKm(line) + 15, 0);
    expect(plan.stops[0].reasons).toEqual(["break"]);
  });

  it("long trips get several evenly spaced breaks, each on the line", () => {
    const line = lineOf(6.3); // about 700 km
    const plan = breakPlan(input(line, { avgSpeedKmh: 90 }), line);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.stops.length).toBeGreaterThanOrEqual(4);
    const kms = [0, ...plan.stops.map((s) => s.stop.distanceAlongRoute_km), routeLengthKm(line)];
    for (let i = 1; i < kms.length; i++) expect(((kms[i] - kms[i - 1]) / 90) * 60).toBeLessThanOrEqual(120);
    for (const s of plan.stops) expect(s.stop.lng).toBeCloseTo(101.5, 3);
  });

  it("breaks claim nothing about what is there: unknown facilities, unverified, clearly named", () => {
    const line = lineOf(1.8);
    const plan = breakPlan(input(line), line);
    if (!plan.ok) throw new Error("expected a plan");
    const stop = plan.stops[0].stop;
    expect(stop.id).toBe("break-1");
    expect(stop.verified).toBe(false);
    expect(Object.values(stop.facilities).every((value) => value === null)).toBe(true);
  });

  it("an EV is told plainly that charging stops cannot be planned without verified charger data", () => {
    const line = lineOf(3.6);
    const plan = breakPlan(input(line, { vehicleType: "ev", range_km: 250 }), line);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.notes.join(" ")).toMatch(/charg/i);
  });
});

describe("search helpers", () => {
  it("turns needs into search terms, with sensible defaults when nothing was asked for", () => {
    expect(searchTerms({ surau: true, ev: true })).toEqual(["surau", "EV charging station"]);
    expect(searchTerms({})).toEqual(["toilet", "petrol station", "restaurant"]);
    expect(searchTerms({ fuel: false })).toEqual(["toilet", "petrol station", "restaurant"]);
  });

  it("builds a Google Maps search link around a point", () => {
    const url = searchUrl("petrol station", 4.1789, 101.29);
    expect(url.startsWith("https://www.google.com/maps/search/?api=1&query=")).toBe(true);
    expect(decodeURIComponent(url)).toContain("petrol station near 4.1789,101.29");
  });
});
