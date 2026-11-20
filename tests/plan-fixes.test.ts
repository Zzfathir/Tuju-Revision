import { describe, expect, it } from "vitest";
import { getRoute } from "@/lib/data";
import { routeLengthKm } from "@/lib/route";
import { planStops, type PlanInput } from "@/lib/planner";
import { applyFix, noStopsPlan, suggestFixes } from "@/lib/plan-fixes";
import type { Stop } from "@/lib/schemas";

const mk = (id: string, km: number, f: Partial<Stop["facilities"]> = {}): Stop => ({
  id, name: id, kind: "rnr", direction: "north", lat: 0, lng: 0, distanceAlongRoute_km: km,
  facilities: { surau: null, toilet: null, fuel: null, evCharger: null, food: null, atm: null, ...f },
  verified: true, source_url: "https://example.org", retrieved_at: "2026-11-20",
});
const base = (over: Partial<PlanInput>): PlanInput => ({
  stops: [], routeKm: 200, departureTime: new Date("2026-11-20T08:00:00+08:00"), avgSpeedKmh: 60,
  vehicleType: "petrol", needs: {}, prayerAware: false, maxDrivingMinutes: 120, dwellMinutes: 15, ...over,
});

describe("suggestFixes", () => {
  it("returns nothing when the plan already works", () => {
    expect(suggestFixes(base({ stops: [mk("A", 100)] }))).toEqual([]);
  });

  it("offers a longer drive when a gap between stops is the problem, and every fix really works", () => {
    const input = base({ stops: [mk("A", 10), mk("B", 190)] });
    expect(planStops(input).ok).toBe(false);
    const fixes = suggestFixes(input);
    expect(fixes).toContainEqual({ kind: "max-drive", minutes: 180 });
    for (const fix of fixes) expect(planStops(applyFix(input, fix)).ok).toBe(true);
  });

  it("offers dropping a need nobody can satisfy, and only that", () => {
    const input = base({ stops: [mk("A", 100, { toilet: true })], needs: { surau: true, toilet: true } });
    const fixes = suggestFixes(input);
    expect(fixes).toEqual([{ kind: "drop-need", need: "surau" }]);
  });

  it("offers turning prayer-aware off when no surau stop lines up", () => {
    const input = base({
      stops: [mk("A", 100)], prayerAware: true, departureTime: new Date("2026-11-20T11:00:00+08:00"),
      prayerWindows: [{ name: "Zohor", start: new Date("2026-11-20T12:00:00+08:00"), end: new Date("2026-11-20T13:00:00+08:00") }],
    });
    expect(planStops(input).ok).toBe(false);
    expect(suggestFixes(input)).toContainEqual({ kind: "prayer-off" });
  });

  it("never returns more than four fixes", () => {
    const input = base({ stops: [mk("A", 10), mk("B", 190)], needs: { surau: true, toilet: true, food: true, fuel: true, ev: true }, prayerAware: true });
    expect(suggestFixes(input).length).toBeLessThanOrEqual(4);
  });

  it("gives the real KL → Ipoh EV with a 150 km range at least one working way forward", () => {
    const { rnr, line } = getRoute();
    const routeKm = routeLengthKm(line);
    const input = base({ stops: rnr.items, routeKm, avgSpeedKmh: routeKm * 60 / (Number(line.properties?.duration_s_freeflow) / 60), vehicleType: "ev", range_km: 150, needs: { ev: true } });
    expect(planStops(input).ok).toBe(false);
    const fixes = suggestFixes(input);
    expect(fixes.length).toBeGreaterThan(0);
    for (const fix of fixes) expect(planStops(applyFix(input, fix)).ok).toBe(true);
  });
});

describe("noStopsPlan", () => {
  it("lets a tester continue with no planned stops, with an honest arrival time", () => {
    const input = base({ stops: [mk("A", 10), mk("B", 190)] });
    const plan = noStopsPlan(input);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.stops).toEqual([]);
    expect(plan.totalMinutes).toBeCloseTo(200, 5); // 200 km at 60 km/h
    expect(plan.arrival.getTime()).toBe(input.departureTime.getTime() + 200 * 60_000);
  });
});
