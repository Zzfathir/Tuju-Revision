import { readFile } from "node:fs/promises";
import path from "node:path";
import { Trip } from "@/components/Trip";
import { getRoute } from "@/lib/data";
import { EtaGrid } from "@/lib/eta-grid";
import { myDate } from "@/lib/prayer";
import { parsePrefs } from "@/lib/onboarding";
import { routeLengthKm } from "@/lib/route";

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const { config, line, rnr, tolls } = getRoute(typeof query.route === "string" ? query.route : undefined);
  const eta = await readFile(path.join(process.cwd(), "data", "routes", config.id, "eta-grid.json"), "utf8")
    .then((value) => EtaGrid.safeParse(JSON.parse(value)).data)
    .catch(() => undefined);
  return <Trip key={config.id} {...{ config, line, rnr, tolls, eta }}
    routeKm={routeLengthKm(line)} date={myDate(new Date())} tester={query.t === "1"} initial={parsePrefs(query)} />;
}
