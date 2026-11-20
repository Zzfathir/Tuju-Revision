import { planStops, type Need, type PlanInput, type PlanResult } from "./planner";
import { pointAt, type RouteLine } from "./route";
import type { Stop } from "./schemas";

const NEED_TERMS: [Need, string][] = [["toilet", "toilet"], ["surau", "surau"], ["food", "restaurant"], ["fuel", "petrol station"], ["ev", "EV charging station"]];
const DEFAULT_TERMS = ["toilet", "petrol station", "restaurant"];

/** What to look for at a break: the facilities the traveller asked for, or the usual three. */
export function searchTerms(needs: Partial<Record<Need, boolean>>): string[] {
  const wanted = NEED_TERMS.filter(([need]) => needs[need]).map(([, term]) => term);
  return wanted.length ? wanted : DEFAULT_TERMS;
}

/** A Google Maps search around a point. We recommend where to look; we never claim what is there. */
export const searchUrl = (term: string, lat: number, lng: number) =>
  "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(`${term} near ${lat},${lng}`);

/**
 * For roads where we hold no verified rest-stop data: evenly spaced break points so no leg is longer than the
 * maximum drive. Break points have unknown facilities by design; the app links to a search at each one.
 */
export function breakPlan(input: PlanInput, line: RouteLine): PlanResult {
  const maxDrive = input.maxDrivingMinutes ?? 120;
  const driveMinutes = (input.routeKm / input.avgSpeedKmh) * 60;
  const count = Math.max(0, Math.ceil(driveMinutes / (maxDrive * 0.9)) - 1);
  const today = new Date().toISOString().slice(0, 10);
  const stops: Stop[] = Array.from({ length: count }, (_, index) => {
    const km = (input.routeKm * (index + 1)) / (count + 1);
    const [lng, lat] = pointAt(line, km);
    return {
      id: `break-${index + 1}`, name: `Break ${index + 1}`, kind: "layby", direction: "",
      lat, lng, distanceAlongRoute_km: Math.round(km * 100) / 100,
      facilities: { surau: null, toilet: null, fuel: null, evCharger: null, food: null, atm: null },
      verified: false, source_url: "https://www.openstreetmap.org/", retrieved_at: today,
    };
  });
  const plan = planStops({
    ...input, stops, needs: {}, prayerAware: false, vehicleType: "petrol",
    range_km: Number.MAX_SAFE_INTEGER, reserve_km: 0,
  });
  if (plan.ok && input.vehicleType === "ev") {
    plan.notes.push("EV: charging stops cannot be planned without verified charger data on this road. Plan charging separately.");
  }
  return plan;
}
