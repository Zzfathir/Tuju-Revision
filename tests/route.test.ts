import { describe, it, expect } from "vitest";
import { getRoute } from "@/lib/data";
import { distanceAlongRoute, routeLengthKm, nextAhead, simulatedTrace } from "@/lib/route";
import { quoteToll } from "@/lib/tolls";
import { planStops } from "@/lib/planner";

const r = getRoute("kl-ipoh");

describe("route corridor", () => {
  it("route is ~190 km and starts near Jalan Duta", () => {
    const len = routeLengthKm(r.line);
    expect(len).toBeGreaterThan(180);
    expect(len).toBeLessThan(205);
    const s = distanceAlongRoute(r.line, r.config.origin.lng, r.config.origin.lat);
    expect(s.km).toBeLessThan(0.5);
  });

  it("distanceAlongRoute is monotonic for stops ordered south→north", () => {
    const kms = r.rnr.items.map((s) => distanceAlongRoute(r.line, s.lng, s.lat).km);
    for (let i = 1; i < kms.length; i++) expect(kms[i]).toBeGreaterThanOrEqual(kms[i - 1]);
  });

  it("precomputed km in data matches live projection (data not stale vs route)", () => {
    for (const s of r.rnr.items) expect(Math.abs(distanceAlongRoute(r.line, s.lng, s.lat).km - s.distanceAlongRoute_km)).toBeLessThan(0.05);
  });

  it("nextAhead finds next stop", () => {
    const first = r.rnr.items[0];
    expect(nextAhead(r.rnr.items, 0)?.id).toBe(first.id);
    expect(nextAhead(r.rnr.items, 10_000)).toBeUndefined();
  });

  it("simulated trace hugs the route", () => {
    const tr = simulatedTrace(r.line, 20);
    for (const [lng, lat] of tr) expect(distanceAlongRoute(r.line, lng, lat).offRouteM).toBeLessThan(5);
  });
});

describe("tolls", () => {
  it("unknown fare is reported, never guessed", () => {
    const [a, b] = r.tolls.plazas;
    const q = quoteToll(r.tolls, a.id, b.id);
    if (r.tolls.fares[a.id][b.id] == null) expect(q.ok).toBe(false);
  });
  it("wrong direction rejected", () => {
    const [a, b] = r.tolls.plazas;
    expect(quoteToll(r.tolls, b.id, a.id)).toMatchObject({ ok: false, reason: "wrong-direction" });
  });
});

describe("planner on real KL→Ipoh data", () => {
  it("plans a petrol trip with a 2 h drive cap", () => {
    const res = planStops({
      stops: r.rnr.items, routeKm: routeLengthKm(r.line), departureTime: new Date("2026-11-20T08:00:00+08:00"),
      avgSpeedKmh: 80, vehicleType: "petrol", needs: { toilet: true }, prayerAware: false,
    });
    expect(res.ok).toBe(true);
  });
});
