import { inMalaysia } from "./bounds";
import type { Place } from "./places";

type Params = Record<string, string | string[] | undefined>;
export type Endpoints = { from: Place; to: Place };

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
const round4 = (value: number) => Math.round(value * 1e4) / 1e4;
const same = (a: Place, b: Place) => round4(a.lat) === round4(b.lat) && round4(a.lng) === round4(b.lng);

function readPlace(point: string | undefined, name: string | undefined, fallback: Place, id: string): Place {
  const parts = (point ?? "").split(",");
  if (parts.length !== 2 || parts.some((part) => part.trim() === "")) return fallback;
  const [lat, lng] = parts.map(Number);
  if (!inMalaysia(lat, lng)) return fallback;
  return { id, name: (name ?? "").trim().slice(0, 60) || "Selected place", detail: "", lat: round4(lat), lng: round4(lng) };
}

/** The trip a link describes. Anything missing or invalid falls back to the default endpoint for that side. */
export function parseTripParams(params: Params, defaults: Endpoints): Endpoints {
  return {
    from: readPlace(first(params.from), first(params.fromName), defaults.from, "url-from"),
    to: readPlace(first(params.to), first(params.toName), defaults.to, "url-to"),
  };
}

/** Address-bar parameters for a trip; empty when both ends are the defaults. */
export function tripParams(from: Place, to: Place, defaults: Endpoints): Record<string, string> {
  if (same(from, defaults.from) && same(to, defaults.to)) return {};
  return { from: `${from.lat},${from.lng}`, fromName: from.name, to: `${to.lat},${to.lng}`, toName: to.name };
}

export const isDefaultTrip = (from: Place, to: Place, defaults: Endpoints) => same(from, defaults.from) && same(to, defaults.to);
