import type { FacilityKey, Stop } from "./schemas";

export type Need = "surau" | "toilet" | "food" | "fuel" | "ev";
export type PrayerWindow = { name: "Zohor" | "Asar" | "Maghrib"; start: Date; end: Date };

export type PlanInput = {
  stops: Stop[];
  routeKm: number;
  departureTime: Date;
  /** average moving speed; caller derives it from the route or the ETA grid */
  avgSpeedKmh: number;
  vehicleType: "petrol" | "ev";
  /** usable range at departure (km). Defaults: petrol 500, ev 250 */
  range_km?: number;
  /** keep this many km in reserve on every leg (default 10% of range) */
  reserve_km?: number;
  maxDrivingMinutes?: number;
  needs: Partial<Record<Need, boolean>>;
  prayerAware: boolean;
  prayerWindows?: PrayerWindow[];
  dwellMinutes?: number;
  chargeMinutes?: number;
};

export type PlannedStop = {
  stop: Stop;
  arrive: Date;
  depart: Date;
  reasons: string[];
  charge: boolean;
};

export type PlanResult =
  | {
      ok: true;
      stops: PlannedStop[];
      arrival: Date;
      totalMinutes: number;
      drivingMinutes: number;
      notes: string[];
    }
  | { ok: false; reason: "range" | "max-driving" | "needs" | "prayer" | "no-stops"; message: string; notes: string[] };

const NEED_TO_FACILITY: Record<Need, FacilityKey> = { surau: "surau", toilet: "toilet", food: "food", fuel: "fuel", ev: "evCharger" };

/** Only an explicit `true` counts. `null` (unknown) never satisfies a constraint. */
export const has = (s: Stop, f: FacilityKey) => s.facilities[f] === true;

/**
 * Constraint-based stop planner.
 * Exact depth-first search over stops sorted by distance along route, with pruning:
 *  - a leg may not exceed max driving minutes or usable range (range - reserve)
 *  - EV range resets only at stops with evCharger === true (charging adds chargeMinutes)
 *  - every requested need must be met by at least one chosen stop
 *  - prayer-aware: any Zohor/Asar/Maghrib window that falls entirely between departure and arrival
 *    must contain the arrival at a chosen stop with surau === true
 * Objective: fewest stops, then earliest arrival, then lexicographic km (deterministic).
 * Stops are on-route R&Rs/lay-bys, so detour ≈ 0 and total time = driving + dwell.
 */
export function planStops(input: PlanInput): PlanResult {
  const {
    stops: rawStops, routeKm, departureTime, avgSpeedKmh, vehicleType, needs, prayerAware,
  } = input;
  const range = input.range_km ?? (vehicleType === "ev" ? 250 : 500);
  const reserve = input.reserve_km ?? range * 0.1;
  const maxDrive = input.maxDrivingMinutes ?? 120;
  const dwell = input.dwellMinutes ?? 15;
  const chargeMin = input.chargeMinutes ?? 30;
  const windows = prayerAware ? input.prayerWindows ?? [] : [];
  const notes: string[] = [];

  const stops = rawStops
    .filter((s) => s.distanceAlongRoute_km > 0 && s.distanceAlongRoute_km < routeKm)
    .sort((a, b) => a.distanceAlongRoute_km - b.distanceAlongRoute_km);

  const minutesFor = (km: number) => (km / avgSpeedKmh) * 60;
  const reqNeeds = (Object.keys(needs) as Need[]).filter((n) => needs[n]);
  if (vehicleType !== "ev" && needs.ev) notes.push("EV charger requested for a petrol vehicle; treated as a facility need only.");
  if (prayerAware && windows.length === 0) notes.push("Prayer-aware is on, but no prayer times were available.");

  // Quick infeasibility diagnostics (used for clear error messages)
  for (const n of reqNeeds) {
    if (!stops.some((s) => has(s, NEED_TO_FACILITY[n]))) {
      return { ok: false, reason: "needs", message: `No stop on this route has a confirmed ${n}.`, notes };
    }
  }

  type Best = { chosen: number[]; charges: boolean[]; arrival: number; drivingMin: number } | null;
  let best: Best = null;
  const t0 = departureTime.getTime();
  const MIN = 60_000;

  const evaluateEnd = (chosen: number[], charges: boolean[], tAtLast: number, kmAtLast: number, rangeLeft: number) => {
    const leg = routeKm - kmAtLast;
    if (minutesFor(leg) > maxDrive || leg > rangeLeft - reserve + 1e-9) return;
    const arrival = tAtLast + minutesFor(leg) * MIN;
    // needs
    for (const n of reqNeeds) if (!chosen.some((i) => has(stops[i], NEED_TO_FACILITY[n]))) return;
    // prayers
    if (windows.length) {
      const arrivals = arrivalTimes(chosen, charges);
      for (const w of windows) {
        const ws = w.start.getTime(), we = w.end.getTime();
        const fullyEnRoute = ws >= t0 && we <= arrival;
        if (!fullyEnRoute) continue;
        const ok = chosen.some((i, k) => has(stops[i], "surau") && arrivals[k] >= ws && arrivals[k] < we);
        if (!ok) return;
      }
    }
    const cand = { chosen: [...chosen], charges: [...charges], arrival, drivingMin: minutesFor(routeKm) };
    if (
      !best ||
      cand.chosen.length < best.chosen.length ||
      (cand.chosen.length === best.chosen.length && cand.arrival < best.arrival - 1) ||
      (cand.chosen.length === best.chosen.length && Math.abs(cand.arrival - best.arrival) <= 1 && lexLess(cand.chosen, best.chosen))
    ) best = cand;
  };

  const arrivalTimes = (chosen: number[], charges: boolean[]) => {
    const out: number[] = [];
    let t = t0, km = 0;
    chosen.forEach((i, k) => {
      t += minutesFor(stops[i].distanceAlongRoute_km - km) * MIN;
      out.push(t);
      t += (charges[k] ? chargeMin : dwell) * MIN;
      km = stops[i].distanceAlongRoute_km;
    });
    return out;
  };

  // DFS: rangeLeft = absolute km left in tank/battery; every leg must keep `reserve` km spare.
  const dfs = (idx: number, chosen: number[], charges: boolean[], t: number, km: number, rangeLeft: number) => {
    if (best && chosen.length > best.chosen.length) return;
    evaluateEnd(chosen, charges, t, km, rangeLeft);
    for (let j = idx; j < stops.length; j++) {
      const s = stops[j];
      const leg = s.distanceAlongRoute_km - km;
      // stops are sorted, so once a leg is infeasible every later stop is too
      if (minutesFor(leg) > maxDrive || leg > rangeLeft - reserve + 1e-9) break;
      if (best && chosen.length + 1 > best.chosen.length) break;
      const left = rangeLeft - leg;
      const canRefill = vehicleType === "ev" ? has(s, "evCharger") : has(s, "fuel");
      const charge = canRefill && left < range - 1e-9;
      const arrive = t + minutesFor(leg) * MIN;
      chosen.push(j); charges.push(charge);
      dfs(j + 1, chosen, charges, arrive + (charge ? chargeMin : dwell) * MIN, s.distanceAlongRoute_km, charge ? range : left);
      chosen.pop(); charges.pop();
    }
  };
  dfs(0, [], [], t0, 0, range);

  if (!best) {
    // Diagnose the most likely reason
    const gaps = [0, ...stops.map((s) => s.distanceAlongRoute_km), routeKm].map((k, i, a) => (i ? k - a[i - 1] : 0));
    const maxGap = Math.max(...gaps);
    if (minutesFor(maxGap) > maxDrive)
      return { ok: false, reason: "max-driving", message: `A ${maxGap.toFixed(0)} km gap between stops is longer than ${maxDrive} min of driving.`, notes };
    if (vehicleType === "ev")
      return { ok: false, reason: "range", message: `No sequence of confirmed EV chargers keeps you within ${range} km range (with ${reserve.toFixed(0)} km reserve).`, notes };
    if (windows.length)
      return { ok: false, reason: "prayer", message: "No stop with a confirmed surau lines up with a prayer window on this departure time. Try leaving earlier or later.", notes };
    return { ok: false, reason: "needs", message: "No combination of stops satisfies all requested needs.", notes };
  }

  const b = best as NonNullable<Best>;
  const arr = arrivalTimes(b.chosen, b.charges);
  const planned: PlannedStop[] = b.chosen.map((i, k) => {
    const s = stops[i];
    const reasons: string[] = [];
    for (const n of reqNeeds) if (has(s, NEED_TO_FACILITY[n])) reasons.push(n);
    if (b.charges[k]) reasons.push(vehicleType === "ev" ? "charge" : "refuel");
    for (const w of windows) if (has(s, "surau") && arr[k] >= w.start.getTime() && arr[k] < w.end.getTime()) reasons.push(`pray:${w.name}`);
    if (!reasons.length) reasons.push("break");
    return { stop: s, arrive: new Date(arr[k]), depart: new Date(arr[k] + (b.charges[k] ? chargeMin : dwell) * MIN), reasons, charge: b.charges[k] };
  });
  for (const w of windows) {
    const ws = w.start.getTime(), we = w.end.getTime();
    if (ws < t0 && we > t0) notes.push(`${w.name} has started before departure; pray before leaving or at a surau stop.`);
    else if (ws >= t0 && ws < b.arrival && we > b.arrival) notes.push(`${w.name} begins on the way and ends after arrival; you can pray at your destination.`);
  }
  return {
    ok: true,
    stops: planned,
    arrival: new Date(b.arrival),
    totalMinutes: (b.arrival - t0) / MIN,
    drivingMinutes: b.drivingMin,
    notes,
  };
}

function lexLess(a: number[], b: number[]) {
  for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return a[i] < b[i];
  return a.length < b.length;
}
