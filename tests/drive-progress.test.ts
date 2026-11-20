import { describe, expect, it } from "vitest";
import { driveProgress } from "../lib/drive-progress";

describe("drive progress", () => {
  const stops = [{ distanceAlongRoute_km: 20 }, { distanceAlongRoute_km: 70 }];

  it("shows the next planned stop and the distance left on the route", () => {
    expect(driveProgress(20, 0, 100, stops)).toEqual({
      state: "moving", fraction: 0.2, remainingKm: 80,
      next: { stop: stops[1], distanceKm: 50 },
    });
    expect(driveProgress(71, 0, 100, stops)).toMatchObject({ state: "moving", next: undefined });
  });

  it("withholds projected progress while locating or away from the route", () => {
    expect(driveProgress(null, 0, 100, stops)).toEqual({ state: "locating" });
    expect(driveProgress(100, 1200, 100, stops)).toEqual({ state: "off-route", distanceKm: 1.2 });
  });

  it("completes the route without producing negative distances", () => {
    expect(driveProgress(102, 0, 100, stops)).toEqual({ state: "arrived" });
  });
});
