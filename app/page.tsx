import { redirect } from "next/navigation";

type Query = Record<string, string | string[] | undefined>;

/** Links naming a route (`/?route=…`) keep working by forwarding to the planner; `/?t=1` shows the landing. */
export default async function Home({ searchParams }: { searchParams: Promise<Query> }) {
  const query = await searchParams;
  if (query.route !== undefined) {
    const forward = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) forward.append(key, item);
    }
    redirect("/plan?" + forward);
  }
  return <main className="page"><h1>Jalan Pulang</h1></main>;
}
