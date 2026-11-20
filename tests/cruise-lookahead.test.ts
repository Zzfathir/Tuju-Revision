import { describe, expect, it } from "vitest";
import { buildEvents, createLookahead, type RouteEvent } from "@/lib/cruise/lookahead";
import { cruiseConfig } from "@/lib/cruise/config";
import type { Stop, TollFile } from "@/lib/schemas";

const toll = (id: string, km: number, over: Partial<RouteEvent> = {}): RouteEvent => ({ id, kind: "toll", name: id, km, planned: false, relevant: true, facilities: [], ...over });
const rnr = (id: string, km: number, over: Partial<RouteEvent> = {}): RouteEvent => ({ id, kind: "rnr", name: id, km, planned: false, relevant: true, facilities: ["surau"], ...over });
const at = (la: ReturnType<typeof createLookahead>, km: number, over: Partial<Parameters<ReturnType<typeof createLookahead>["update"]>[0]> = {}) =>
  la.update({ km, speedMps: 25, now: 0, voice: "full", muted: false, ...over });

describe("alert levels", () => {
  it("L1 at 5 km, L2 at 2 km, L3 at 500 m", () => {
    const la = createLookahead([toll("T", 100)], cruiseConfig);
    expect(at(la, 90).alerts).toEqual([]); // 10 km away
    expect(at(la, 94.9).alerts).toEqual([]); // 5.1 km: just outside
    expect(at(la, 95.1).alerts[0].level).toBe(1);
    expect(at(la, 98).alerts[0].level).toBe(2);
    expect(at(la, 99.6).alerts[0].level).toBe(3);
  });

  it("L3 also fires on time: under 30 seconds away, even when still over 500 m", () => {
    const la = createLookahead([toll("T", 100)], cruiseConfig);
    const alert = at(la, 98.8, { speedMps: 50 }).alerts[0]; // 1.2 km at 50 m/s is 24 s
    expect(alert.level).toBe(3);
    expect(alert.etaS).toBeCloseTo(24, 5);
  });

  it("never divides by a near-zero speed: a crawl or a stop gives a sane ETA, not Infinity", () => {
    const la = createLookahead([toll("T", 100)], cruiseConfig);
    const alert = at(la, 99, { speedMps: 0 }).alerts[0]; // 1 km, stationary
    expect(Number.isFinite(alert.etaS)).toBe(true);
    expect(alert.etaS).toBeCloseTo(200, 5); // 1000 m at the 5 m/s floor
    expect(alert.level).toBe(2); // not L3: 200 s away
  });

  it("drops an event once it has been passed", () => {
    const la = createLookahead([toll("T", 100)], cruiseConfig);
    expect(at(la, 100.04).alerts).toHaveLength(1);
    expect(at(la, 100.2).alerts).toEqual([]);
  });

  it("orders active alerts nearest first", () => {
    const la = createLookahead([rnr("far", 103), toll("near", 100.5)], cruiseConfig);
    expect(at(la, 100).alerts.map((a) => a.event.id)).toEqual(["near", "far"]);
  });
});

describe("once per level per event", () => {
  it("reports each level as newly reached exactly once", () => {
    const la = createLookahead([toll("T", 100)], cruiseConfig);
    const seen: string[] = [];
    for (const km of [94.5, 94.6, 95.5, 97.9, 98.1, 99.7, 99.8, 99.9]) {
      for (const r of at(la, km, { now: km * 1000 }).reached) seen.push(`${r.id}:${r.level}`);
    }
    expect(seen).toEqual(["T:1", "T:2", "T:3"]);
  });

  it("speaks each of L2 and L3 once, and never L1", () => {
    const la = createLookahead([toll("T", 100)], cruiseConfig);
    const spoken: number[] = [];
    let now = 0;
    for (const km of [94.5, 95, 97.9, 98.1, 98.5, 99.7, 99.8, 99.9]) {
      now += 20_000; // far apart, so cooldown never interferes
      const speak = at(la, km, { now }).speak;
      if (speak) spoken.push(speak.level);
    }
    expect(spoken).toEqual([2, 3]);
  });

  it("an event first seen already inside L3 is spoken once, as L3 only", () => {
    const la = createLookahead([toll("T", 100)], cruiseConfig);
    const first = at(la, 99.7, { now: 1000 });
    expect(first.speak?.level).toBe(3);
    expect(first.reached.map((r) => r.level).sort()).toEqual([1, 2, 3]);
    expect(at(la, 99.8, { now: 30_000 }).speak).toBeNull();
  });
});

describe("voice cooldown and priority", () => {
  it("allows one voice line per 8 s, deferring (not losing) the next", () => {
    const la = createLookahead([toll("A", 100), rnr("B", 100.2)], cruiseConfig);
    const a = at(la, 98.3, { now: 0 });
    expect(a.speak?.id).toBe("A");
    expect(at(la, 98.4, { now: 3000 }).speak).toBeNull(); // cooldown: B waits
    const later = at(la, 98.6, { now: 9000 });
    expect(later.speak?.id).toBe("B"); // still pending, spoken once the cooldown has passed
  });

  it("an L3 alert interrupts a recent L2 line", () => {
    const la = createLookahead([toll("A", 100), toll("B", 101)], cruiseConfig);
    expect(at(la, 98.2, { now: 0 }).speak?.level).toBe(2);
    const urgent = at(la, 100.6, { now: 2000 }); // B is now 400 m away; A has been passed
    expect(urgent.speak).toMatchObject({ id: "B", level: 3, interrupt: true });
  });

  it("an L3 line does not interrupt another L3 line inside the cooldown", () => {
    const la = createLookahead([toll("A", 100), toll("B", 100.3)], cruiseConfig);
    expect(at(la, 99.6, { now: 0 }).speak?.level).toBe(3);
    expect(at(la, 99.7, { now: 2000 }).speak).toBeNull();
  });
});

describe("filters and suppression", () => {
  it("raises nothing for events the user filtered out", () => {
    const la = createLookahead([rnr("EV", 100, { relevant: false })], cruiseConfig);
    const result = at(la, 99.7);
    expect(result.alerts).toEqual([]);
    expect(result.speak).toBeNull();
    expect(result.reached).toEqual([]);
  });

  it("above 110 km/h cards are suppressed but the alert and voice remain", () => {
    const la = createLookahead([toll("T", 100)], cruiseConfig);
    const fast = at(la, 98, { speedMps: 32 }); // 115 km/h
    expect(fast.cardsSuppressed).toBe(true);
    expect(fast.alerts).toHaveLength(1);
    expect(fast.speak?.level).toBe(2);
    expect(at(createLookahead([toll("T", 100)], cruiseConfig), 98, { speedMps: 30 }).cardsSuppressed).toBe(false); // 108 km/h
  });

  it("muted: alerts still show, nothing is spoken, and nothing is spoken later either", () => {
    const la = createLookahead([toll("T", 100)], cruiseConfig);
    const quiet = at(la, 98, { muted: true });
    expect(quiet.alerts).toHaveLength(1);
    expect(quiet.speak).toBeNull();
    expect(at(la, 98.1, { muted: false, now: 60_000 }).speak).toBeNull(); // the L2 moment passed silently
  });

  it("Reduced voice speaks only L3", () => {
    const la = createLookahead([toll("T", 100)], cruiseConfig);
    expect(at(la, 98, { voice: "reduced" }).speak).toBeNull();
    expect(at(la, 99.7, { voice: "reduced", now: 20_000 }).speak?.level).toBe(3);
  });

  it("Normal voice speaks L2 for tolls and planned stops but keeps merely-matching stops visual until L3", () => {
    const la = createLookahead([rnr("matches", 100, { planned: false }), rnr("planned", 105, { planned: true })], cruiseConfig);
    expect(at(la, 98, { voice: "normal", now: 0 }).speak).toBeNull(); // matches, not planned
    expect(at(la, 103, { voice: "normal", now: 20_000 }).speak?.id).toBe("planned");
    expect(at(createLookahead([rnr("m", 100)], cruiseConfig), 99.7, { voice: "normal" }).speak?.level).toBe(3);
  });
});

describe("buildEvents", () => {
  const stop = (id: string, km: number, facilities: Partial<Stop["facilities"]> = {}): Stop => ({
    id, name: id, kind: "rnr", direction: "north", lat: 0, lng: 0, distanceAlongRoute_km: km,
    facilities: { surau: null, toilet: null, fuel: null, evCharger: null, food: null, atm: null, ...facilities },
    verified: true, source_url: "https://example.org", retrieved_at: "2026-11-20",
  });
  const plazas: TollFile["plazas"] = [{ id: "P", name: "Plaza P", lat: 0, lng: 0, distanceAlongRoute_km: 40, type: "closed-entry-exit" }];

  it("always includes tolls, planned stops, and stops that satisfy a selected need; sorted by km", () => {
    const events = buildEvents({
      plazas, stops: [stop("surau", 90, { surau: true }), stop("plain", 60), stop("planned", 70)], plannedIds: ["planned"], needs: { surau: true },
    });
    expect(events.filter((e) => e.relevant).map((e) => e.id)).toEqual(["P", "planned", "surau"]);
    expect(events.find((e) => e.id === "plain")?.relevant).toBe(false);
    expect(events.map((e) => e.km)).toEqual([...events.map((e) => e.km)].sort((a, b) => a - b));
  });

  it("with no needs and nothing planned, only tolls are relevant", () => {
    const events = buildEvents({ plazas, stops: [stop("a", 50, { surau: true })], plannedIds: [], needs: {} });
    expect(events.filter((e) => e.relevant).map((e) => e.kind)).toEqual(["toll"]);
  });

  it("lists only the facilities that are confirmed true, and flags planned stops", () => {
    const [event] = buildEvents({ plazas: [], stops: [stop("t", 50, { surau: true, evCharger: true, toilet: false, fuel: null })], plannedIds: ["t"], needs: {} });
    expect(event.facilities).toEqual(["surau", "ev"]);
    expect(event.planned).toBe(true);
  });

  it("treats evenly spaced break points as planned break events", () => {
    const events = buildEvents({ plazas: [], stops: [stop("break-2", 80)], plannedIds: ["break-2"], needs: {} });
    expect(events[0]).toMatchObject({ kind: "break", planned: true, relevant: true });
  });
});
