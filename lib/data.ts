/**
 * Route registry. Adding a route = add a folder under data/routes/<id>/ and one import line here.
 * (Static imports keep the data bundled + cacheable offline; no fs at runtime.)
 */
import klIpohConfig from "@/data/routes/kl-ipoh/config.json";
import klIpohRoute from "@/data/routes/kl-ipoh/route.geojson";
import klIpohRnr from "@/data/routes/kl-ipoh/rnr.json";
import klIpohTolls from "@/data/routes/kl-ipoh/tolls.json";
import klIpohGaz from "@/data/routes/kl-ipoh/gazetteer.json";
import { RnrFile, RouteConfig, TollFile } from "./schemas";
import type { RouteLine } from "./route";

export type Gazetteer = { source_url: string; retrieved_at: string; verified: boolean; places: { id: string; name: string; lat: number; lng: number; km: number; state: string }[] };

export type RouteBundle = {
  config: RouteConfig;
  line: RouteLine;
  rnr: RnrFile;
  tolls: TollFile;
  gazetteer: Gazetteer;
};

const raw = {
  "kl-ipoh": { config: klIpohConfig, line: klIpohRoute, rnr: klIpohRnr, tolls: klIpohTolls, gazetteer: klIpohGaz },
} as const;

export type RouteId = keyof typeof raw;
export const ROUTE_IDS = Object.keys(raw) as RouteId[];
export const DEFAULT_ROUTE: RouteId = "kl-ipoh";

const cache = new Map<string, RouteBundle>();
export function getRoute(id: string = DEFAULT_ROUTE): RouteBundle {
  const key = (id in raw ? id : DEFAULT_ROUTE) as RouteId;
  if (cache.has(key)) return cache.get(key)!;
  const r = raw[key];
  const bundle: RouteBundle = {
    config: RouteConfig.parse(r.config),
    line: r.line as unknown as RouteLine,
    rnr: RnrFile.parse(r.rnr),
    tolls: TollFile.parse(r.tolls),
    gazetteer: r.gazetteer as Gazetteer,
  };
  cache.set(key, bundle);
  return bundle;
}
