import fallback from "@/data/places-my.json";

export type Place = { id: string; name: string; detail: string; lat: number; lng: number; approximate?: boolean };

/** Quick picks for the empty search state: the drives people actually make. */
const POPULAR_IDS = ["kuala-lumpur", "ipoh", "george-town", "johor-bahru", "melaka", "seremban", "kuantan", "kota-bharu", "kuala-terengganu", "alor-setar"];
const toPlace = (p: (typeof fallback.places)[number]): Place => ({ id: p.id, name: p.name, detail: p.state, lat: p.lat, lng: p.lng, approximate: true });
const ALL = fallback.places.map(toPlace);
export const POPULAR: Place[] = POPULAR_IDS.map((id) => ALL.find((p) => p.id === id)!).filter(Boolean);

export function searchFallback(query: string, limit = 8): Place[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const starts = ALL.filter((p) => p.name.toLowerCase().startsWith(q));
  const contains = ALL.filter((p) => !p.name.toLowerCase().startsWith(q) && (p.name.toLowerCase().includes(q) || p.detail.toLowerCase().includes(q)));
  return [...starts, ...contains].slice(0, limit);
}

type Json = Record<string, unknown>;
const isObject = (value: unknown): value is Json => typeof value === "object" && value !== null;

/** Photon (OpenStreetMap) feature collection to simple Malaysian place results. Never throws on odd input. */
export function normalizePhoton(json: unknown): Place[] {
  if (!isObject(json) || !Array.isArray(json.features)) return [];
  const seen = new Set<string>();
  const out: Place[] = [];
  for (const feature of json.features) {
    if (!isObject(feature) || !isObject(feature.properties) || !isObject(feature.geometry)) continue;
    const props = feature.properties;
    const coords = feature.geometry.coordinates;
    if (props.countrycode !== "MY" || typeof props.name !== "string" || !props.name.trim()) continue;
    if (!Array.isArray(coords) || !Number.isFinite(coords[0]) || !Number.isFinite(coords[1])) continue;
    const [lng, lat] = coords as number[];
    const id = `${props.osm_type ?? "x"}${props.osm_id ?? props.name}`;
    const key = id + "|" + props.name + lat.toFixed(3) + lng.toFixed(3);
    if (seen.has(id) || seen.has(key)) continue;
    seen.add(id); seen.add(key);
    const detail = [props.street, props.county, props.state]
      .filter((part, i, all): part is string => typeof part === "string" && part !== "" && all.indexOf(part) === i).join(", ");
    out.push({ id, name: props.name.trim(), detail, lat, lng });
  }
  return out;
}
