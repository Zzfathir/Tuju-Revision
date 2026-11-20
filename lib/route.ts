import * as turf from "@turf/turf";
import type { Feature, LineString } from "geojson";

export type RouteLine = Feature<LineString>;

/** Key primitive: km from route start of the closest point on the route, plus off-route distance. */
export function distanceAlongRoute(line: RouteLine, lng: number, lat: number) {
  const snapped = turf.nearestPointOnLine(line, turf.point([lng, lat]), { units: "kilometers" });
  return {
    km: snapped.properties.location as number,
    offRouteM: (snapped.properties.dist as number) * 1000,
    snapped: snapped.geometry.coordinates as [number, number],
  };
}

export function routeLengthKm(line: RouteLine) {
  return turf.length(line, { units: "kilometers" });
}

export function pointAt(line: RouteLine, km: number): [number, number] {
  return turf.along(line, km, { units: "kilometers" }).geometry.coordinates as [number, number];
}

/** Simulated GPS trace along the route (for demo "simulate drive"). */
export function simulatedTrace(line: RouteLine, stepKm = 0.5): [number, number][] {
  const len = routeLengthKm(line);
  const pts: [number, number][] = [];
  for (let k = 0; k <= len; k += stepKm) pts.push(pointAt(line, k));
  return pts;
}

/** Find next item ahead of current km (items sorted by km). */
export function nextAhead<T extends { distanceAlongRoute_km: number }>(items: T[], km: number, pred: (t: T) => boolean = () => true) {
  return items.find((i) => i.distanceAlongRoute_km > km + 0.05 && pred(i));
}

/**
 * The next `aheadKm` of route from `km`, for drawing a lit ribbon ahead of the car. Always a drawable line (two or more
 * points), even at or beyond the end of the route.
 */
export function sliceAhead(line: RouteLine, km: number, aheadKm: number): RouteLine {
  const total = routeLengthKm(line);
  const from = Math.max(0, Math.min(km, total - 0.001));
  const to = Math.min(total, from + Math.max(0.001, aheadKm));
  return turf.lineSliceAlong(line, from, to, { units: "kilometers" }) as RouteLine;
}
