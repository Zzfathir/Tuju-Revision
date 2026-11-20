import { describe, expect, it } from "vitest";
import { getRoute } from "@/lib/data";
import { makeProjector } from "@/lib/enrich";
import { routeLengthKm } from "@/lib/route";
import { createSimulator } from "@/lib/cruise/simulator";
import { bearingDiff } from "@/lib/cruise/pipeline";

const { line } = getRoute("kl-ipoh");
const total = routeLengthKm(line);
const { project } = makeProjector(line);

describe("createSimulator", () => {
  it("emits one fix per simulated second with a steadily increasing clock", () => {
    const sim = createSimulator(line, total);
    const fixes = sim.tick(60);
    expect(fixes).toHaveLength(60);
    fixes.forEach((fix, i) => expect(fix.t).toBe(i * 1000));
    expect(sim.tick(5).map((f) => f.t)).toEqual([60_000, 61_000, 62_000, 63_000, 64_000]);
  });

  it("starts from a standstill, accelerates to motorway speed, and stays on the route", () => {
    const fixes = createSimulator(line, total).tick(120);
    expect(fixes[0].speed).toBeLessThan(1);
    const cruising = fixes[100].speed!;
    expect(cruising).toBeGreaterThan(24); // about 90 km/h
    expect(cruising).toBeLessThan(31); // under 110 km/h
    for (const fix of fixes) expect(project(fix.lng, fix.lat).offM).toBeLessThan(10);
  });

  it("covers distance consistent with its speed", () => {
    const sim = createSimulator(line, total);
    const fixes = sim.tick(300);
    const travelledKm = project(fixes.at(-1)!.lng, fixes.at(-1)!.lat).km - project(fixes[0].lng, fixes[0].lat).km;
    const expectedKm = fixes.reduce((sum, f) => sum + (f.speed ?? 0) / 1000, 0);
    expect(Math.abs(travelledKm - expectedKm)).toBeLessThan(0.5);
    expect(sim.km()).toBeCloseTo(expectedKm, 0);
  });

  it("slows down near a slow zone such as a toll plaza", () => {
    const sim = createSimulator(line, total, { slowZonesKm: [8] });
    const near: number[] = [];
    let guard = 0;
    while (sim.km() < 10 && guard++ < 2000) {
      for (const fix of sim.tick(1)) {
        const km = project(fix.lng, fix.lat).km;
        if (Math.abs(km - 8) < 1) near.push(fix.speed!);
      }
    }
    expect(near.length).toBeGreaterThan(10);
    expect(Math.max(...near)).toBeLessThanOrEqual(17.5); // 60 km/h
  });

  it("an injected detour really leaves the route and then rejoins it", () => {
    const sim = createSimulator(line, total, { startKm: 40 });
    sim.tick(30); // settle at speed first
    sim.injectDetour({ lengthKm: 1.5, offsetM: 400 });
    const offs = sim.tick(120).map((f) => project(f.lng, f.lat).offM);
    expect(Math.max(...offs)).toBeGreaterThan(300);
    expect(offs.at(-1)!).toBeLessThan(10); // back on the road after the detour
    expect(offs.findIndex((m) => m > 120)).toBeGreaterThan(-1);
  });

  it("keeps the heading along the route, even during a detour", () => {
    const sim = createSimulator(line, total, { startKm: 60 });
    sim.tick(20);
    sim.injectDetour({ lengthKm: 1, offsetM: 300 });
    for (const fix of sim.tick(60)) {
      if ((fix.speed ?? 0) < 2) continue;
      expect(bearingDiff(fix.heading!, (project(fix.lng, fix.lat).bearing + 360) % 360)).toBeLessThan(25);
    }
  });

  it("slows to a crawl for the last stretch instead of arriving at motorway speed", () => {
    const sim = createSimulator(line, total, { startKm: total - 4 });
    const speeds: { km: number; speed: number }[] = [];
    let guard = 0;
    while (!sim.done() && guard++ < 1000) for (const fix of sim.tick(1)) speeds.push({ km: project(fix.lng, fix.lat).km, speed: fix.speed! });
    const final = speeds.filter((s) => s.km > total - 0.3);
    expect(final.length).toBeGreaterThan(3);
    expect(Math.max(...final.map((s) => s.speed))).toBeLessThanOrEqual(8); // under about 30 km/h within 300 m
    expect(speeds.at(-1)!.speed).toBeLessThan(5);
    expect(sim.done()).toBe(true); // it still gets there
  });

  it("is deterministic: the same options give identical fixes", () => {
    expect(createSimulator(line, total).tick(50)).toEqual(createSimulator(line, total).tick(50));
  });

  it("finishes at the end of the route and then emits nothing more", () => {
    const sim = createSimulator(line, total, { startKm: total - 1 });
    let emitted = 0, guard = 0;
    while (!sim.done() && guard++ < 500) emitted += sim.tick(10).length;
    expect(sim.done()).toBe(true);
    expect(emitted).toBeGreaterThan(5);
    expect(sim.km()).toBeGreaterThanOrEqual(total - 0.001);
    expect(sim.tick(10)).toEqual([]);
  });
});
