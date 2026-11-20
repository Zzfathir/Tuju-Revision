import { redirect } from "next/navigation";

/** The Side quests lives in a sheet over the map (DESIGN.md); old links open it there. */
export default async function Page({ searchParams }: { searchParams: Promise<{ lang?: string }> }) {
  const lang = (await searchParams).lang === "bm" ? "&lang=bm" : "";
  redirect(`/?sheet=quests${lang}`);
}
