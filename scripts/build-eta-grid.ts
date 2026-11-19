import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { RouteConfig } from "../lib/schemas";

const MAX_REQUESTS = 50;
const routeId = process.argv[2] ?? "kl-ipoh";
const date = process.argv[3] ?? "";
const every = Number(process.argv.find((arg) => arg.startsWith("--every="))?.split("=")[1] ?? 60);
const endpoint = "https://routes.googleapis.com/directions/v2:computeRoutes";
const RoutesResponse = z.object({ routes: z.array(z.object({ duration: z.string().regex(/^\d+(\.\d+)?s$/) })).min(1) });

async function main() {
  if (!/^[a-z0-9-]+$/.test(routeId) || !/^\d{4}-\d{2}-\d{2}$/.test(date)
      || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) {
    throw new Error("Usage: npm run build:eta -- <route-id> <YYYY-MM-DD> [--every=60]");
  }
  if (!Number.isInteger(every) || every < 1 || Math.ceil(1440 / every) > MAX_REQUESTS) {
    throw new Error("Choose a whole-minute interval that keeps the grid at or below 50 requests.");
  }
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) throw new Error("GOOGLE_MAPS_API_KEY is unset. The app will use the heuristic profile.");
  const dir = path.join("data", "routes", routeId);
  const config = RouteConfig.parse(JSON.parse(fs.readFileSync(path.join(dir, "config.json"), "utf8")));
  const location = ({ lat, lng }: { lat: number; lng: number }) => ({ location: { latLng: { latitude: lat, longitude: lng } } });
  const grid: { depart: string; duration_min: number }[] = [];
  for (let minute = 0; minute < 1440; minute += every) {
    const depart = String(Math.floor(minute / 60)).padStart(2, "0") + ":" + String(minute % 60).padStart(2, "0");
    const departure = new Date(date + "T" + depart + ":00+08:00");
    if (departure.getTime() <= Date.now()) continue;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": "routes.duration" },
      body: JSON.stringify({ origin: location(config.origin), destination: location(config.destination),
        travelMode: "DRIVE", routingPreference: "TRAFFIC_AWARE", departureTime: departure.toISOString() }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error("Routes API returned HTTP " + response.status + " for " + depart);
    const { routes } = RoutesResponse.parse(await response.json());
    grid.push({ depart, duration_min: Math.max(1, Math.round(Number.parseFloat(routes[0].duration) / 60)) });
  }
  if (!grid.length) throw new Error("The grid requires at least one future departure in Malaysia time.");
  fs.writeFileSync(path.join(dir, "eta-grid.json"), JSON.stringify({
    routeId, date, source: "Google Routes API TRAFFIC_AWARE prediction",
    source_url: "https://developers.google.com/maps/documentation/routes", retrieved_at: new Date().toISOString(),
    verified: true, requests_used: grid.length, grid,
  }, null, 2) + "\n");
  console.log("Saved " + grid.length + " slots (" + grid.length + "/" + MAX_REQUESTS + " requests).");
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
