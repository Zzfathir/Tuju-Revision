import { redirect } from "next/navigation";
import { Landing } from "@/components/Landing";
import { getRoute } from "@/lib/data";
import { parsePrefs } from "@/lib/onboarding";
import { routeLengthKm } from "@/lib/route";
import { quoteToll } from "@/lib/tolls";

type Query = Record<string, string | string[] | undefined>;

export default async function Home({ searchParams }: { searchParams: Promise<Query> }) {
  const query = await searchParams;
  // Links naming a route (`/?route=…`) keep working by forwarding to the planner; `/?t=1` shows the landing.
  if (query.route !== undefined) {
    const forward = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) forward.append(key, item);
    }
    redirect("/plan?" + forward);
  }
  const { line, tolls } = getRoute();
  const km = routeLengthKm(line);
  const quote = quoteToll(tolls, tolls.plazas[0]?.id ?? "", tolls.plazas.at(-1)?.id ?? "");
  return <Landing km={km} tollRm={quote.ok ? quote.fare : null} tester={query.t === "1"} initialLang={parsePrefs(query).lang}
    driveMinutes={Number(line.properties?.duration_s_freeflow) / 60 || km / 90 * 60} />;
}
