import { inMalaysia } from "./bounds";
import type { Place } from "./places";

export const RECENTS_KEY = "jalan-pulang-recent-places";
const MAX = 6;
const spot = (place: Place) => place.lat.toFixed(4) + "," + place.lng.toFixed(4);

/** Newest first, the same spot (to four decimals) never twice, at most six. */
export function addRecent(list: Place[], place: Place): Place[] {
  return [place, ...list.filter((item) => spot(item) !== spot(place))].slice(0, MAX);
}

const isPlace = (value: unknown): value is Place => {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Record<string, unknown>;
  return typeof item.id === "string" && typeof item.name === "string" && typeof item.detail === "string"
    && typeof item.lat === "number" && typeof item.lng === "number" && inMalaysia(item.lat, item.lng);
};

/** Stored data is untrusted input: anything malformed is dropped, never thrown. */
export function parseRecents(text: string | null): Place[] {
  if (!text) return [];
  try {
    const parsed: unknown = JSON.parse(text);
    return Array.isArray(parsed) ? parsed.filter(isPlace).slice(0, MAX) : [];
  } catch { return []; }
}

export function readRecents(): Place[] {
  try { return parseRecents(localStorage.getItem(RECENTS_KEY)); } catch { return []; }
}

export function saveRecent(place: Place): Place[] {
  const next = addRecent(readRecents(), place);
  try { localStorage.setItem(RECENTS_KEY, JSON.stringify(next)); } catch { /* storage may be blocked */ }
  return next;
}
