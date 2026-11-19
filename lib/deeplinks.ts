/**
 * Navigation hand-off. We prepare, Google Maps / Waze route. Zero API cost.
 * Google Maps URLs (documented): https://developers.google.com/maps/documentation/urls/get-started
 * Waze deep links (documented): https://developers.google.com/waze/deeplinks — single destination only.
 */
type LL = { lat: number; lng: number; name?: string };
const ll = (p: LL) => `${p.lat},${p.lng}`;

export function googleMapsUrl(origin: LL | null, destination: LL, waypoints: LL[] = []) {
  const q = new URLSearchParams({ api: "1", destination: ll(destination), travelmode: "driving" });
  if (origin) q.set("origin", ll(origin));
  // Google supports three waypoints in mobile browsers. The caller splits longer trips into legs.
  if (waypoints.length) q.set("waypoints", waypoints.slice(0, 3).map(ll).join("|"));
  return `https://www.google.com/maps/dir/?${q.toString()}`;
}

export function wazeUrl(destination: LL) {
  return `https://waze.com/ul?ll=${encodeURIComponent(ll(destination))}&navigate=yes`;
}

/** Waze can't take waypoints → one link per leg: stop1, stop2, …, destination */
export function wazeLegs(destination: LL, stops: LL[]) {
  return [...stops, destination].map((p, i) => ({ leg: i + 1, name: p.name ?? "", url: wazeUrl(p) }));
}

export function telUrl(n: string) {
  return `tel:${n.replace(/[^\d+]/g, "")}`;
}
