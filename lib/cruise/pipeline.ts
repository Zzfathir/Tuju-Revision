import { makeProjector } from "../enrich";
import type { RouteLine } from "../route";
import type { CruiseConfig } from "./config";

/** A raw position report. `t` is milliseconds on whatever clock the source uses (real time, or simulated time). */
export type Fix = { t: number; lat: number; lng: number; speed: number | null; heading: number | null; accuracy: number | null };

/** A filtered, smoothed fix snapped onto the route. Speed is m/s, bearings are degrees 0 to 360. */
export type Snapped = {
  t: number; lat: number; lng: number; speed: number; heading: number;
  km: number; offM: number; routeBearing: number; remainingKm: number;
};

/** Smallest angle between two headings in degrees, 0 to 180. */
export function bearingDiff(a: number, b: number): number {
  return Math.abs(((a - b + 540) % 360) - 180);
}

/** A backwards step shorter than this (km) is treated as smoothing jitter. */
const BACKSLIP_KM = 0.05;

/** Snapping looks this far behind and ahead of the last position (a route can double back over itself, so forward progress wins). Beyond LOST_M the search widens to the whole route. */
const BACK_WINDOW_KM = 0.05;
const AHEAD_WINDOW_KM = 2;
const LOST_M = 300;

const normalise = (degrees: number) => ((degrees % 360) + 360) % 360;

/** filter (accuracy) → smooth (EMA) → snap to the route. One instance per drive; it remembers the smoothed state. */
export function createPipeline(line: RouteLine, cfg: Pick<CruiseConfig, "maxAccuracyM" | "posAlpha" | "speedAlpha" | "headingMinSpeed">) {
  const { project, totalKm } = makeProjector(line);
  let ema: { lat: number; lng: number; speed: number } | null = null;
  let lastKm = 0;
  let tracking = false;

  return {
    push(fix: Fix): Snapped | null {
      if (fix.accuracy !== null && fix.accuracy > cfg.maxAccuracyM) return null;
      const speedIn = fix.speed !== null && Number.isFinite(fix.speed) ? Math.max(0, fix.speed) : null;
      ema = ema === null
        ? { lat: fix.lat, lng: fix.lng, speed: speedIn ?? 0 }
        : {
          lat: cfg.posAlpha * fix.lat + (1 - cfg.posAlpha) * ema.lat,
          lng: cfg.posAlpha * fix.lng + (1 - cfg.posAlpha) * ema.lng,
          speed: speedIn === null ? ema.speed : cfg.speedAlpha * speedIn + (1 - cfg.speedAlpha) * ema.speed,
        };
      // Track near where we were. Only when that finds nothing close (we are lost, or this is the first fix) search the whole route.
      let spot = tracking ? project(ema.lng, ema.lat, { from: lastKm - BACK_WINDOW_KM, to: lastKm + AHEAD_WINDOW_KM }) : project(ema.lng, ema.lat);
      if (tracking && spot.offM > LOST_M) spot = project(ema.lng, ema.lat);
      tracking = true;
      // Smoothing can let the projection slip a few metres backwards on a curve. A slip that small is jitter, not reversing.
      const km = spot.km < lastKm && lastKm - spot.km <= BACKSLIP_KM ? lastKm : spot.km;
      lastKm = km;
      const routeBearing = normalise(spot.bearing);
      const useGpsHeading = fix.heading !== null && Number.isFinite(fix.heading) && ema.speed >= cfg.headingMinSpeed;
      return {
        t: fix.t, lat: ema.lat, lng: ema.lng, speed: ema.speed,
        heading: useGpsHeading ? normalise(fix.heading as number) : routeBearing,
        km, offM: spot.offM, routeBearing, remainingKm: Math.max(0, totalKm - km),
      };
    },
  };
}
