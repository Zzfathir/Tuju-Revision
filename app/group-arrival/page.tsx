import { GroupCreate } from "@/components/GroupArrival";
import { myTimeInput } from "@/lib/group-time";

export const dynamic = "force-dynamic";

export default async function GroupArrivalPage({ searchParams }: { searchParams: Promise<{ lang?: string }> }) {
  const lang = (await searchParams).lang === "bm" ? "bm" : "en";
  return <GroupCreate lang={lang} defaultStart={myTimeInput(Date.now() + 3600_000)} />;
}
