import { describe, expect, it } from "vitest";
import { getRoute } from "@/lib/data";
import { routeLengthKm } from "@/lib/route";
import { createCruise } from "@/lib/cruise/engine";
import { buildEvents } from "@/lib/cruise/lookahead";
import { createSimulator } from "@/lib/cruise/simulator";
import { cruiseConfig } from "@/lib/cruise/config";
import type { CruiseState } from "@/lib/cruise/machine";

const route = getRoute("kl-ipoh");
const total = routeLengthKm(route.line);
const tapah = route.rnr.items.find((s) => s.name.includes("Tapah"))!;
const events = buildEvents({ plazas: route.tolls.plazas, stops: route.rnr.items, plannedIds: [tapah.id], needs: { surau: true } });
const controls = { voice: "full" as const, muted: false };

describe("createCruise", () => {
  it("starts idle and ignores fixes until armed", () => {
    const cruise = createCruise({ line: route.line, routeKm: total, events });
    expect(cruise.snapshot().state).toBe("IDLE");
    const sim = createSimulator(route.line, total);
    expect(cruise.push(sim.tick(1)[0], controls).state).toBe("IDLE");
    expect(cruise.snapshot().km).toBeNull();
  });

  it("START and SIMULATE arm it, and record where the position comes from", () => {
    const gps = createCruise({ line: route.line, routeKm: total, events });
    expect(gps.start()).toMatchObject({ state: "ARMED", source: "gps" });
    const sim = createCruise({ line: route.line, routeKm: total, events });
    expect(sim.simulate()).toMatchObject({ state: "ARMED", source: "sim" });
  });

  it("notices it is on the route with no destination entered, after five good fixes", () => {
    const cruise = createCruise({ line: route.line, routeKm: total, events });
    cruise.simulate();
    const sim = createSimulator(route.line, total, { startKm: 50 });
    const states: CruiseState[] = [];
    for (const fix of sim.tick(8)) states.push(cruise.push(fix, controls).state);
    expect(states.slice(0, 4)).toEqual(["ARMED", "ARMED", "ARMED", "ARMED"]);
    expect(states[4]).toBe("CRUISING");
  });

  it("drops fixes that are too inaccurate without changing anything", () => {
    const cruise = createCruise({ line: route.line, routeKm: total, events });
    cruise.simulate();
    const [fix] = createSimulator(route.line, total).tick(1);
    const after = cruise.push({ ...fix, accuracy: 120 }, controls);
    expect(after.state).toBe("ARMED");
    expect(after.km).toBeNull();
  });

  it("reports speed in km/h, remaining distance and an ETA that never divides by a near-zero speed", () => {
    const cruise = createCruise({ line: route.line, routeKm: total, events });
    cruise.simulate();
    const sim = createSimulator(route.line, total, { startKm: 100 });
    let last = cruise.snapshot();
    for (const fix of sim.tick(40)) last = cruise.push(fix, controls);
    expect(last.speedKmh).toBeGreaterThan(70);
    expect(last.remainingKm!).toBeCloseTo(total - last.km!, 5);
    expect(last.etaMs!).toBeGreaterThan(last.lastFixT);
    const stopped = createCruise({ line: route.line, routeKm: total, events });
    stopped.simulate();
    const crawl = createSimulator(route.line, total, { startKm: 100 }).tick(1)[0]; // speed 0 at the first fix
    const snapshot = stopped.push({ ...crawl, t: 0 }, controls);
    if (snapshot.etaMs !== null) expect(Number.isFinite(snapshot.etaMs)).toBe(true);
  });

  it("exit ends the drive from any active state, and a finished drive stays finished", () => {
    const cruise = createCruise({ line: route.line, routeKm: total, events });
    cruise.simulate();
    expect(cruise.exit().state).toBe("ENDED");
    expect(cruise.start().state).toBe("ENDED");
    expect(cruise.simulate().state).toBe("ENDED");
  });
});

describe("a whole simulated drive, end to end", () => {
  it("goes IDLE → ARMED → CRUISING → OFF_ROUTE → CRUISING → ARRIVING → ENDED, with every alert once", () => {
    const cruise = createCruise({ line: route.line, routeKm: total, events });
    const sim = createSimulator(route.line, total, { slowZonesKm: route.tolls.plazas.map((p) => p.distanceAlongRoute_km) });
    const sequence: CruiseState[] = [cruise.snapshot().state];
    const record = (state: CruiseState) => { if (sequence.at(-1) !== state) sequence.push(state); };
    const spoken: string[] = [];
    const duringOffRoute: number[] = [];
    let detoured = false;

    record(cruise.simulate().state);
    let guard = 0;
    while (!sim.done() && guard++ < 20_000) {
      const km = sim.km();
      if (!detoured && km > 60) { sim.injectDetour({ lengthKm: 1.5, offsetM: 400 }); detoured = true; }
      for (const fix of sim.tick(1)) {
        const snapshot = cruise.push(fix, controls);
        record(snapshot.state);
        if (snapshot.speak) spoken.push(`${snapshot.speak.id}:${snapshot.speak.level}`);
        if (snapshot.state === "OFF_ROUTE") duringOffRoute.push(snapshot.alerts.length);
      }
    }
    record(cruise.exit().state);

    expect(sequence).toEqual(["IDLE", "ARMED", "CRUISING", "OFF_ROUTE", "CRUISING", "ARRIVING", "ENDED"]);
    expect(new Set(spoken).size).toBe(spoken.length); // each line spoken at most once
    expect(spoken.some((line) => line.startsWith(tapah.id + ":"))).toBe(true); // the planned R&R was announced
    expect(spoken.some((line) => line.startsWith("plaza-tol-"))).toBe(true);
    expect(duringOffRoute.length).toBeGreaterThan(0);
    expect(duringOffRoute.every((n) => n === 0)).toBe(true); // no stale alerts while we do not know where we are
  }, 120_000);

  it("marks the drive as arrived only at the end of the route", () => {
    const cruise = createCruise({ line: route.line, routeKm: total, events });
    cruise.simulate();
    const sim = createSimulator(route.line, total, { startKm: total - 6 });
    let arrivedAt: number | null = null;
    let guard = 0;
    while (!sim.done() && guard++ < 2000) {
      for (const fix of sim.tick(1)) {
        const snapshot = cruise.push(fix, controls);
        if (snapshot.arrived && arrivedAt === null) arrivedAt = snapshot.remainingKm;
        if (snapshot.state === "ARRIVING") expect(snapshot.remainingKm!).toBeLessThan(cruiseConfig.arrivingKm);
      }
    }
    expect(arrivedAt).not.toBeNull();
    expect(arrivedAt!).toBeLessThan(0.1);
  });
});
