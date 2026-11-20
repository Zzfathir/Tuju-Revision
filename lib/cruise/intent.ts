import type { CruiseConfig } from "./config";
import type { CruiseEvent, CruiseState } from "./machine";
import { bearingDiff, type Snapped } from "./pipeline";

/**
 * Intent detector: turns snapped fixes into state-machine events. Pure and deterministic (heuristics, no model).
 * Counters live here and reset whenever the state changes, so nothing leaks between states.
 */
export function createIntent(cfg: Pick<CruiseConfig,
  "enterFixes" | "enterOffM" | "enterHeadingDeg" | "headingMinSpeed" | "offRouteM" | "offRouteSeconds" | "returnFixes" | "returnOffM" | "arrivingKm">) {
  let lastState: CruiseState | null = null;
  let good = 0;
  let back = 0;
  let offSince: number | null = null;
  const reset = () => { good = 0; back = 0; offSince = null; };

  return {
    reset,
    step(state: CruiseState, s: Snapped): CruiseEvent | null {
      if (state !== lastState) { reset(); lastState = state; }

      if (state === "ARMED") {
        // Heading is only meaningful when moving; the other carriageway (opposite heading) must not count as on-route.
        const headingOk = s.speed < cfg.headingMinSpeed || bearingDiff(s.heading, s.routeBearing) <= cfg.enterHeadingDeg;
        good = s.offM < cfg.enterOffM && headingOk ? good + 1 : 0;
        if (good >= cfg.enterFixes) { good = 0; return "ON_ROUTE"; }
        return null;
      }

      if (state === "CRUISING") {
        if (s.remainingKm < cfg.arrivingKm) return "NEAR_END";
        if (s.offM > cfg.offRouteM) {
          offSince ??= s.t;
          return s.t - offSince >= cfg.offRouteSeconds * 1000 ? "OFF" : null; // far AND for long enough
        }
        offSince = null;
        return null;
      }

      if (state === "OFF_ROUTE") {
        back = s.offM < cfg.returnOffM ? back + 1 : 0;
        if (back >= cfg.returnFixes) { back = 0; return "ON_ROUTE"; }
        return null;
      }

      return null; // IDLE, ARRIVING, ENDED: the user ends the drive
    },
  };
}
