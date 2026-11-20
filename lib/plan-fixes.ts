import { planStops, type Need, type PlanInput, type PlanResult } from "./planner";

/** One-tap ways to turn an infeasible plan into a working one. */
export type Fix =
  | { kind: "max-drive"; minutes: number }
  | { kind: "range"; km: number }
  | { kind: "drop-need"; need: Need }
  | { kind: "prayer-off" };

const MAX_FIXES = 4;

export function applyFix(input: PlanInput, fix: Fix): PlanInput {
  switch (fix.kind) {
    case "max-drive": return { ...input, maxDrivingMinutes: fix.minutes };
    case "range": return { ...input, range_km: fix.km };
    case "drop-need": return { ...input, needs: { ...input.needs, [fix.need]: false } };
    case "prayer-off": return { ...input, prayerAware: false };
  }
}

/**
 * Changes that, applied one at a time, make an infeasible plan feasible.
 * Every suggestion is checked with the real planner, so none is a guess. Smallest changes first.
 */
export function suggestFixes(input: PlanInput): Fix[] {
  if (planStops(input).ok) return [];
  const currentDrive = input.maxDrivingMinutes ?? 120;
  const currentRange = input.range_km ?? (input.vehicleType === "ev" ? 250 : 500);
  const candidates: Fix[] = [
    ...[150, 180, 240].filter((minutes) => minutes > currentDrive).map((minutes): Fix => ({ kind: "max-drive", minutes })),
    ...[300, 400, 500].filter((km) => km > currentRange).map((km): Fix => ({ kind: "range", km })),
    ...(Object.keys(input.needs) as Need[]).filter((need) => input.needs[need]).map((need): Fix => ({ kind: "drop-need", need })),
    ...(input.prayerAware ? [{ kind: "prayer-off" } as Fix] : []),
  ];
  return candidates.filter((fix) => planStops(applyFix(input, fix)).ok).slice(0, MAX_FIXES);
}

/** The honest "no planned stops" trip: straight through, arrival from driving time alone. */
export function noStopsPlan(input: PlanInput): PlanResult {
  return planStops({
    ...input, stops: [], needs: {}, prayerAware: false, maxDrivingMinutes: Number.MAX_SAFE_INTEGER, range_km: Number.MAX_SAFE_INTEGER,
  });
}
