import { Planner, type PlannerQuery } from "@/components/Planner";

export default async function Plan({ searchParams }: { searchParams: Promise<PlannerQuery> }) {
  return <Planner query={await searchParams} />;
}
