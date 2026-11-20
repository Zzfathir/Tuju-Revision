import { Landing } from "@/components/Landing";
import { Planner, type PlannerQuery } from "@/components/Planner";
import { parsePrefs } from "@/lib/onboarding";

export default async function Home({ searchParams }: { searchParams: Promise<PlannerQuery> }) {
  const query = await searchParams;
  if (query.home === "1" || query.welcome === "1") {
    return <Landing initial={parsePrefs(query)} tester={query.t === "1"} home={query.home === "1"} />;
  }
  return <Planner query={query} startOnMap={query.route === undefined} />;
}
