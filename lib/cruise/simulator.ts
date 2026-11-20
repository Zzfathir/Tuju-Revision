import * as turf from "@turf/turf";
import { pointAt, type RouteLine } from "../route";
import type { Fix } from "./pipeline";

export type SimOptions = {
  /** Where along the route the simulated drive starts (km). */
  startKm?: number;
  /** Kilometres along the route where the car slows to 60 km/h within 1.5 km (toll plazas). */
  slowZonesKm?: number[];
  /** Motorway cruising speed at the start and at the end of the route, km/h. */
  cruiseKmh?: [number, number];
};

const SLOW_RADIUS_KM = 1.5;
/** The last stretch of the route over which the car slows down, and the crawl it never drops below (so it still arrives). */
const ARRIVAL_TAPER_KM = 1.5;
const ARRIVAL_FLOOR_MPS = 3;
const SLOW_MPS = 60 / 3.6;
const ACCELERATE = 2; // m/s per second
const BRAKE = 2.5;
const smooth = (x: number) => { const c = Math.max(0, Math.min(1, x)); return c * c * (3 - 2 * c); };

/**
 * A deterministic fake GPS: true 1 Hz fixes along the route with a believable speed profile, slow zones at tolls and an
 * optional detour. It feeds the same pipeline as a real phone, so a demo exercises the real logic. The caller decides how
 * fast to play it: calling `tick(60)` once per second is real time; calling it more often is a fast-forward.
 */
export function createSimulator(line: RouteLine, routeKm: number, options: SimOptions = {}) {
  const [cruiseStart, cruiseEnd] = options.cruiseKmh ?? [90, 110];
  const slowZones = options.slowZonesKm ?? [];
  let km = options.startKm ?? 0;
  let speed = 0; // m/s
  let t = 0;
  let finished = false;
  let detour: { startKm: number; endKm: number; offsetM: number } | null = null;

  const bearingAt = (at: number) => {
    const a = pointAt(line, Math.max(0, at - 0.02)), b = pointAt(line, Math.min(routeKm, at + 0.02));
    return (turf.bearing(turf.point(a), turf.point(b)) + 360) % 360;
  };
  const targetSpeed = () => {
    const cruise = (cruiseStart + (cruiseEnd - cruiseStart) * Math.min(1, km / routeKm)) / 3.6;
    const zoned = slowZones.some((zone) => Math.abs(km - zone) <= SLOW_RADIUS_KM) ? Math.min(cruise, SLOW_MPS) : cruise;
    // Slow smoothly over the last stretch so the car pulls up at the destination instead of arriving at motorway speed.
    const taper = Math.max(ARRIVAL_FLOOR_MPS, Math.min(1, (routeKm - km) / ARRIVAL_TAPER_KM) * zoned);
    return Math.min(zoned, taper);
  };

  return {
    /** Advance `simSeconds` of simulated time and return one fix per second. */
    tick(simSeconds: number): Fix[] {
      const fixes: Fix[] = [];
      for (let i = 0; i < simSeconds && !finished; i++) {
        const heading = bearingAt(km);
        let [lng, lat] = pointAt(line, Math.min(km, routeKm));
        if (detour) {
          if (km > detour.endKm) detour = null;
          else {
            const progress = (km - detour.startKm) / (detour.endKm - detour.startKm);
            const metres = detour.offsetM * smooth(progress / 0.25) * smooth((1 - progress) / 0.25);
            if (metres > 0) [lng, lat] = turf.destination(turf.point([lng, lat]), metres / 1000, heading + 90, { units: "kilometers" }).geometry.coordinates;
          }
        }
        fixes.push({ t, lat, lng, speed, heading, accuracy: 6 });
        t += 1000;
        if (km >= routeKm) { finished = true; km = routeKm; break; }
        km = Math.min(routeKm, km + speed / 1000);
        const delta = targetSpeed() - speed;
        speed += Math.max(-BRAKE, Math.min(ACCELERATE, delta));
      }
      return fixes;
    },
    /** Take the next stretch of road on a detour: the car drifts `offsetM` off the route for `lengthKm`, then rejoins. */
    injectDetour({ lengthKm = 1.2, offsetM = 400 }: { lengthKm?: number; offsetM?: number } = {}) {
      detour = { startKm: km + 0.15, endKm: km + 0.15 + lengthKm, offsetM };
    },
    km: () => km,
    done: () => finished,
  };
}
