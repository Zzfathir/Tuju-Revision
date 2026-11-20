import { nextAhead } from "./route";

type AlongRoute = { distanceAlongRoute_km: number };

export function driveProgress<T extends AlongRoute>(km: number | null, offRouteM: number, routeKm: number, stops: T[]) {
  if (km === null) return { state: "locating" } as const;
  if (offRouteM > 1000) return { state: "off-route", distanceKm: offRouteM / 1000 } as const;
  if (km >= routeKm - 0.1) return { state: "arrived" } as const;

  const stop = nextAhead(stops, km);
  return {
    state: "moving",
    fraction: km / routeKm,
    remainingKm: routeKm - km,
    next: stop ? { stop, distanceKm: stop.distanceAlongRoute_km - km } : undefined,
  } as const;
}
