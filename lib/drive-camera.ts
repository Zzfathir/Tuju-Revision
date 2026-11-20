import { pointAt, type RouteLine } from "./route";

export type DrivePoint = [number, number];
export type DriveFrame = {
  point: DrivePoint; course: number | null; fraction: number | null;
  /** Current speed, used to zoom out a little as the car goes faster. Absent for plain route replays. */
  speedKmh?: number;
};

export function bearingBetween(from: DrivePoint, to: DrivePoint) {
  const north = to[1] - from[1];
  const east = (to[0] - from[0]) * Math.cos(from[1] * Math.PI / 180);
  return Math.atan2(east, north) * 180 / Math.PI;
}

export function driveCourse(line: RouteLine, km: number, routeKm: number, gps?: {
  heading: number | null; speed: number | null; onRoute: boolean;
}): number | null {
  if (gps?.heading != null && Number.isFinite(gps.heading) && (gps.speed ?? 0) >= 1.5) return gps.heading;
  if (gps && !gps.onRoute) return null;
  // A short distance around the fix limits jitter without looking around a distant turn.
  return bearingBetween(pointAt(line, Math.max(0, km - 0.045)), pointAt(line, Math.min(routeKm, km + 0.09)));
}

/** Heading-up turns the map with the car; north-up keeps north at the top. Flat 2D is always north-up. */
export function driveCamera(perspective: boolean, course: number | null, height: number, headingUp = true) {
  const offset: [number, number] = [0, perspective ? Math.round(Math.min(height * 0.12, 84)) : 0];
  return { bearing: perspective && headingUp ? course ?? 0 : 0, pitch: perspective ? 54 : 0, offset };
}
