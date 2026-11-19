import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GroupRoom } from "@/components/GroupArrival";

export const metadata: Metadata = { robots: { index: false, follow: false }, referrer: "no-referrer" };

export default async function GroupArrivalRoom({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ lang?: string }>;
}) {
  const [{ id }, { lang }] = await Promise.all([params, searchParams]);
  if (!/^[a-f0-9]{32}$/.test(id)) notFound();
  return <GroupRoom id={id} lang={lang === "bm" ? "bm" : "en"} />;
}
