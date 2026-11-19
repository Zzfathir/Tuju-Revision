/**
 * Builds rnr.json + tolls.json for a route from saved OpenStreetMap Overpass fixtures.
 *   npx tsx scripts/build-pois.ts [routeId] [--fetch-amenities]
 * - Keeps only features within MAX_OFF_ROUTE_M of the precomputed route line.
 * - Keeps only facilities on the travel side (Malaysia drives on the left → left of travel direction),
 *   or features shared by both directions (e.g. mainline toll plazas).
 * - Facility flags come ONLY from OSM amenity nodes found inside/near each R&R. Unknown = null, never false.
 * - Toll fares are NOT in OSM → fare:null, verified:false until hand-checked against PLUS.
 */
import fs from "node:fs";
import path from "node:path";
import * as turf from "@turf/turf";

const routeId = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : "kl-ipoh";
const dir = path.join("data/routes", routeId);
const route = JSON.parse(fs.readFileSync(path.join(dir, "route.geojson"), "utf8"));
const line = turf.lineString(route.geometry.coordinates);
const osm = JSON.parse(fs.readFileSync("fixtures/overpass-rnr-toll.json", "utf8"));
const MAX_OFF_ROUTE_M = 350;
const NSE_PLAZAS = /^Plaza Tol (Jalan Duta|Sungai Buloh|Rawang|Rawang Selatan|Bukit Beruntung|Bukit Tagar|Lembah Beringin|Tanjung Malim|Behrang|Slim River|Sungkai|Bidor|Tapah|Gopeng|Simpang Pulai|Ipoh Selatan)\b/;
const OSM_URL = (t: string, id: number) => `https://www.openstreetmap.org/${t}/${id}`;
const retrieved_at = fs.statSync("fixtures/overpass-rnr-toll.json").mtime.toISOString();

type El = { type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags: Record<string, string> };

function project(lng: number, lat: number) {
  const p = turf.point([lng, lat]);
  const snapped = turf.nearestPointOnLine(line, p, { units: "kilometers" });
  const km = snapped.properties.location as number;
  const offM = (snapped.properties.dist as number) * 1000;
  // side: sign of cross product between travel direction and vector to point
  const a = turf.along(line, Math.max(0, km - 0.05), { units: "kilometers" }).geometry.coordinates;
  const b = turf.along(line, km + 0.05, { units: "kilometers" }).geometry.coordinates;
  const cross = (b[0] - a[0]) * (lat - a[1]) - (b[1] - a[1]) * (lng - a[0]);
  return { km, offM, side: cross > 0 ? "left" : "right" };
}

const els: El[] = osm.elements;
const pos = (e: El) => (e.center ? e.center : { lat: e.lat!, lon: e.lon! });

// ---------- R&R ----------
const rnrRaw = els
  .filter((e) => (e.tags.highway === "services" || e.tags.highway === "rest_area") && e.tags.name)
  .map((e) => ({ e, ...project(pos(e).lon, pos(e).lat) }))
  .filter((x) => x.offM <= MAX_OFF_ROUTE_M)
  .filter((x) => !/selatan|south/i.test(x.e.tags.name)) // explicitly southbound-only facilities
  .filter((x) => x.side === "left" || /utara|north/i.test(x.e.tags.name))
  .filter((x) => !/^(Azbicentre|Carcuzzi|Sun SSD|Aras Kilat|Petronas$)/i.test(x.e.tags.name)); // businesses, not R&Rs

// dedupe by name within 1 km
const rnrList: typeof rnrRaw = [];
for (const x of rnrRaw.sort((a, b) => a.km - b.km)) {
  if (!rnrList.some((y) => y.e.tags.name === x.e.tags.name && Math.abs(y.km - x.km) < 1)) rnrList.push(x);
}

async function fetchAmenities() {
  const around = rnrList.map((x) => `${pos(x.e).lat},${pos(x.e).lon}`).join(",");
  const q = `[out:json][timeout:90];(nwr(around:250,${around})["amenity"~"^(place_of_worship|fuel|charging_station|toilets|restaurant|fast_food|food_court|cafe|atm)$"];);out center tags;`;
  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: { "User-Agent": "jalan-pulang-hackathon/0.1", "Content-Type": "application/x-www-form-urlencoded" },
    body: "data=" + encodeURIComponent(q),
  });
  if (!res.ok) throw new Error("overpass " + res.status);
  fs.writeFileSync("fixtures/overpass-amenities.json", await res.text());
}

async function main() {
  if (process.argv.includes("--fetch-amenities")) await fetchAmenities();
  const amen: El[] = fs.existsSync("fixtures/overpass-amenities.json")
    ? JSON.parse(fs.readFileSync("fixtures/overpass-amenities.json", "utf8")).elements
    : [];

  // Hand-checked overrides: a human confirmed a fact and recorded where. Highest precedence.
  const ovPath = path.join(dir, "rnr-overrides.json");
  const overrides: Record<string, { facilities?: Record<string, boolean | null>; source_url: string; checked_at: string; note?: string }> =
    fs.existsSync(ovPath) ? JSON.parse(fs.readFileSync(ovPath, "utf8")).overrides ?? {} : {};

  // Layer 1: the R&R element's own OSM tags (e.g. toilets=yes). Layer 2: amenity nodes within 250 m.
  const facilitiesFor = (lat: number, lng: number, own: Record<string, string>) => {
    const near = amen.filter((a) => turf.distance([lng, lat], [pos(a).lon, pos(a).lat], { units: "meters" }) <= 250);
    const yes = (v?: string) => v === "yes";
    const has = (ownYes: boolean, pred: (t: Record<string, string>) => boolean) => (ownYes || near.some((a) => pred(a.tags)) ? true : null);
    return {
      surau: has(false, (t) => t.amenity === "place_of_worship" && (t.religion === "muslim" || /surau|masjid/i.test(t.name ?? ""))),
      toilet: has(yes(own.toilets) || yes(own.toilet), (t) => t.amenity === "toilets"),
      fuel: has(yes(own.fuel), (t) => t.amenity === "fuel"),
      evCharger: has(false, (t) => t.amenity === "charging_station"),
      food: has(yes(own.restaurant) || yes(own.food), (t) => ["restaurant", "fast_food", "food_court", "cafe"].includes(t.amenity)),
      atm: has(yes(own.atm), (t) => t.amenity === "atm" || t.atm === "yes"),
    };
  };

  const rnr = rnrList.map((x) => {
    const p = pos(x.e);
    const name = x.e.tags.name;
    const kind = /hentian sebelah|lay-?by/i.test(name) ? "layby" : x.e.tags.highway === "services" || /kawasan rehat|r&r|rnr/i.test(name) ? "rnr" : "layby";
    const id = `osm-${x.e.type}-${x.e.id}`;
    const ov = overrides[id];
    const osmFac = facilitiesFor(p.lat, p.lon, x.e.tags);
    return {
      id,
      name,
      name_en: x.e.tags["name:en"] ?? null,
      kind,
      direction: "north",
      lat: +p.lat.toFixed(6),
      lng: +p.lon.toFixed(6),
      distanceAlongRoute_km: +x.km.toFixed(2),
      facilities: { ...osmFac, ...(ov?.facilities ?? {}) },
      facilities_source: ov
        ? `Hand-checked (${ov.checked_at}): ${ov.source_url}; remaining fields from OpenStreetMap`
        : "OpenStreetMap tags on the R&R + amenity nodes within 250 m. Unknown is null, never false.",
      verified: Boolean(ov),
      source_url: ov?.source_url ?? OSM_URL(x.e.type, x.e.id),
      osm_url: OSM_URL(x.e.type, x.e.id),
      retrieved_at: ov?.checked_at ?? retrieved_at,
    };
  });

  // ---------- Tolls (mainline plazas on route, both directions share a plaza) ----------
  const tollRaw = els
    .filter((e) => e.tags.barrier === "toll_booth" && e.tags.name)
    .map((e) => ({ e, ...project(pos(e).lon, pos(e).lat) }))
    .filter((x) => x.offM <= 600)
    // NSE (E1) interchange plazas between KL and Ipoh; other highways' plazas near the line are excluded
    .filter((x) => NSE_PLAZAS.test(x.e.tags.name));
  const tolls: { id: string; name: string; lat: number; lng: number; distanceAlongRoute_km: number; source_url: string }[] = [];
  for (const x of tollRaw.sort((a, b) => a.km - b.km)) {
    const name = x.e.tags.name.replace(/\s*\((Arah|Plaza).*?\)\s*/i, "").trim();
    if (tolls.some((t) => t.name === name)) continue;
    tolls.push({ id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"), name, lat: +pos(x.e).lat.toFixed(6), lng: +pos(x.e).lon.toFixed(6), distanceAlongRoute_km: +x.km.toFixed(2), source_url: OSM_URL(x.e.type, x.e.id) });
  }

  fs.writeFileSync(path.join(dir, "rnr.json"), JSON.stringify({ routeId, source: "OpenStreetMap via Overpass API", source_url: "https://overpass-api.de/", retrieved_at, verified: false, items: rnr }, null, 2));
  fs.writeFileSync(path.join(dir, "toll-plazas.osm.json"), JSON.stringify({ routeId, source: "OpenStreetMap barrier=toll_booth", retrieved_at, items: tolls }, null, 2));
  console.table(rnr.map((r) => ({ km: r.distanceAlongRoute_km, name: r.name, kind: r.kind, ...r.facilities })));
  console.table(tolls.map((t) => ({ km: t.distanceAlongRoute_km, name: t.name })));
}
main().catch((e) => { console.error(e); process.exit(1); });
