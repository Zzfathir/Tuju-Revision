import { describe, expect, it } from "vitest";
import { getRoute } from "@/lib/data";
import { pointAt, routeLengthKm, sliceAhead } from "@/lib/route";

const { line } = getRoute("kl-ipoh");
const total = routeLengthKm(line);

describe("sliceAhead", () => {
  it("returns the next few kilometres of route, starting at the car", () => {
    const ahead = sliceAhead(line, 50, 6);
    expect(ahead.geometry.coordinates.length).toBeGreaterThan(5);
    expect(routeLengthKm(ahead)).toBeGreaterThan(5.8);
    expect(routeLengthKm(ahead)).toBeLessThan(6.2);
    const [lng, lat] = pointAt(line, 50);
    expect(Math.abs(ahead.geometry.coordinates[0][0] - lng)).toBeLessThan(0.001);
    expect(Math.abs(ahead.geometry.coordinates[0][1] - lat)).toBeLessThan(0.001);
  });

  it("stops at the end of the route", () => {
    const ahead = sliceAhead(line, total - 2, 6);
    expect(routeLengthKm(ahead)).toBeGreaterThan(1.8);
    expect(routeLengthKm(ahead)).toBeLessThan(2.2);
  });

  it("is still a drawable line at, or beyond, the very end", () => {
    for (const km of [total, total + 5]) {
      const ahead = sliceAhead(line, km, 6);
      expect(ahead.geometry.type).toBe("LineString");
      expect(ahead.geometry.coordinates.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("clamps a negative position to the start", () => {
    const ahead = sliceAhead(line, -3, 4);
    expect(routeLengthKm(ahead)).toBeGreaterThan(3.8);
  });
});
