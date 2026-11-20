import { readFile } from "node:fs/promises";
import path from "node:path";
import { TripShell } from "@/components/TripShell";
import { getRoute } from "@/lib/data";
import { EtaGrid } from "@/lib/eta-grid";
import { parsePrefs } from "@/lib/onboarding";
import { myDate } from "@/lib/prayer";
import { routeLengthKm } from "@/lib/route";
import { parseTripParams } from "@/lib/trip-url";

export type PlannerQuery = Record<string, string | string[] | undefined>;

export async function Planner({ query, startOnMap = false }: { query: PlannerQuery; startOnMap?: boolean }) {
  const { config, line, rnr, tolls } = getRoute(typeof query.route === "string" ? query.route : undefined);
  const eta = await readFile(path.join(process.cwd(), "data", "routes", config.id, "eta-grid.json"), "utf8")
    .then((value) => EtaGrid.safeParse(JSON.parse(value)).data)
    .catch(() => undefined);
  const defaults = {
    from: { id: "default-from", detail: "", ...config.origin },
    to: { id: "default-to", detail: "", ...config.destination },
  };
  return <TripShell curated={{ config, line, rnr, tolls }} eta={eta} routeKm={routeLengthKm(line)} date={myDate(new Date())}
    tester={query.t === "1"} initial={parsePrefs(query)} start={parseTripParams(query, defaults)} startOnMap={startOnMap} />;
}
