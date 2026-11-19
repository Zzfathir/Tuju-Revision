/**
 * One-time route builder. Run ONCE, commit the output, never call routing at runtime.
 *   npx tsx scripts/build-route.ts [routeId]
 * Uses OSRM public demo server (usage limits unverified → exactly one request, no loop).
 * If GOOGLE_MAPS_API_KEY is set you could swap in Routes API; OSRM is the default.
 */
import fs from "node:fs";
import path from "node:path";

const routeId = process.argv[2] ?? "kl-ipoh";
const cfgPath = path.join("data/routes", routeId, "config.json");
const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
const [o, d] = [cfg.origin, cfg.destination];
const via = (cfg.via ?? []).map((v: { lng: number; lat: number }) => `${v.lng},${v.lat}`);
const coords = [`${o.lng},${o.lat}`, ...via, `${d.lng},${d.lat}`].join(";");
const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`;

async function main() {
  const res = await fetch(url, { headers: { "User-Agent": "jalan-pulang-hackathon/0.1" } });
  if (!res.ok) throw new Error(`OSRM ${res.status}`);
  const j = await res.json();
  const r = j.routes[0];
  const out = {
    type: "Feature",
    properties: {
      routeId,
      distance_m: r.distance,
      duration_s_freeflow: r.duration,
      source: "OSRM public demo (router.project-osrm.org), OpenStreetMap data © OSM contributors",
      source_url: url,
      retrieved_at: new Date().toISOString(),
      verified: true,
    },
    geometry: r.geometry,
  };
  fs.writeFileSync(path.join("data/routes", routeId, "route.geojson"), JSON.stringify(out));
  fs.writeFileSync(path.join("fixtures", `osrm-${routeId}.json`), JSON.stringify(j));
  console.log(`wrote route ${routeId}: ${(r.distance / 1000).toFixed(1)} km, ${r.geometry.coordinates.length} pts`);
}
main().catch((e) => { console.error(e); process.exit(1); });
