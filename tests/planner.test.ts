import { describe, it, expect } from "vitest";
import { planStops, type PlanInput } from "@/lib/planner";
import type { Stop } from "@/lib/schemas";

const mk = (id: string, km: number, f: Partial<Stop["facilities"]> = {}): Stop => ({
  id, name: id, kind: "rnr", direction: "north", lat: 0, lng: 0, distanceAlongRoute_km: km,
  facilities: { surau: null, toilet: null, fuel: null, evCharger: null, food: null, atm: null, ...f },
  verified: true, source_url: "https://example.org", retrieved_at: "2026-11-20",
});

// 60 km/h → 1 km per minute, makes arithmetic obvious
const base = (over: Partial<PlanInput>): PlanInput => ({
  stops: [], routeKm: 200, departureTime: new Date("2026-11-20T08:00:00+08:00"), avgSpeedKmh: 60,
  vehicleType: "petrol", needs: {}, prayerAware: false, maxDrivingMinutes: 120, dwellMinutes: 15, ...over,
});

describe("planStops", () => {
  it("single-stop plan: picks one stop that splits the trip under max driving time", () => {
    const r = planStops(base({ stops: [mk("A", 50), mk("B", 100), mk("C", 150)] }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.stops).toHaveLength(1);
    expect(r.stops[0].stop.id).toBe("B"); // A leaves 150 km (>120), C has 150 first leg; B is the only 1-stop option
    expect(r.totalMinutes).toBe(215);
  });

  it("no feasible plan: gap longer than max driving time", () => {
    const r = planStops(base({ stops: [mk("A", 10), mk("B", 190)] }));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe("max-driving");
  });

  it("no feasible plan: need not available anywhere (unknown ≠ yes)", () => {
    const r = planStops(base({ stops: [mk("A", 100, { surau: null })], needs: { surau: true } }));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe("needs");
  });

  it("needs: chooses the stop that actually has the facility", () => {
    const r = planStops(base({ stops: [mk("A", 90), mk("B", 110, { surau: true, evCharger: true })], needs: { surau: true, ev: true } }));
    expect(r.ok && r.stops.map((s) => s.stop.id)).toEqual(["B"]);
  });

  it("EV range edge case: exactly at usable range is allowed, 1 km over is not", () => {
    // range 110, reserve 10 → usable 100 per leg. Charger at 100 → legs 100 + 100.
    const stops = [mk("CH", 100, { evCharger: true })];
    const ok = planStops(base({ stops, vehicleType: "ev", range_km: 110, reserve_km: 10, maxDrivingMinutes: 300 }));
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.stops[0].charge).toBe(true);
    const bad = planStops(base({ stops: [mk("CH", 101, { evCharger: true })], vehicleType: "ev", range_km: 110, reserve_km: 10, maxDrivingMinutes: 300 }));
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.reason).toBe("range");
  });

  it("EV: a stop without charger does not reset range", () => {
    const r = planStops(base({ stops: [mk("NO", 100)], vehicleType: "ev", range_km: 150, reserve_km: 0, maxDrivingMinutes: 300 }));
    expect(r.ok).toBe(false);
  });

  it("prayer-time conflict: forces a surau stop inside the window", () => {
    // depart 12:00, 200 km at 60 km/h → 15:20 arrival w/ one stop. Zohor 13:00–14:00 fully en route.
    const stops = [mk("A", 30), mk("SURAU", 60, { surau: true }), mk("B", 100)];
    const prayerWindows = [{ name: "Zohor" as const, start: new Date("2026-11-20T13:00:00+08:00"), end: new Date("2026-11-20T14:00:00+08:00") }];
    const without = planStops(base({ stops, departureTime: new Date("2026-11-20T12:00:00+08:00"), maxDrivingMinutes: 130 }));
    expect(without.ok && without.stops.map((s) => s.stop.id)).toEqual(["B"]);
    const withP = planStops(base({ stops, departureTime: new Date("2026-11-20T12:00:00+08:00"), maxDrivingMinutes: 130, prayerAware: true, prayerWindows }));
    expect(withP.ok).toBe(true);
    if (!withP.ok) return;
    const ids = withP.stops.map((s) => s.stop.id);
    expect(ids).toContain("SURAU");
    expect(withP.stops.find((s) => s.stop.id === "SURAU")!.reasons).toContain("pray:Zohor");
  });

  it("prayer-time conflict with no surau inside window → infeasible with prayer reason", () => {
    const stops = [mk("SURAU_EARLY", 20, { surau: true }), mk("B", 100)];
    const prayerWindows = [{ name: "Zohor" as const, start: new Date("2026-11-20T13:00:00+08:00"), end: new Date("2026-11-20T13:30:00+08:00") }];
    const r = planStops(base({ stops, departureTime: new Date("2026-11-20T12:00:00+08:00"), maxDrivingMinutes: 150, prayerAware: true, prayerWindows }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("prayer");
  });

  it("prayer window ending after arrival is a note, not a constraint", () => {
    const prayerWindows = [{ name: "Asar" as const, start: new Date("2026-11-20T09:00:00+08:00"), end: new Date("2026-11-20T18:00:00+08:00") }];
    const r = planStops(base({ stops: [mk("B", 100)], prayerAware: true, prayerWindows }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.notes.join(" ")).toMatch(/destination/);
  });

  it("short trip needs zero stops", () => {
    const r = planStops(base({ routeKm: 100, stops: [mk("A", 50)] }));
    expect(r.ok && r.stops.length).toBe(0);
  });
});
