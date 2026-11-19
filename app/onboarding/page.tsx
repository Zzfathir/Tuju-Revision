import type { Metadata } from "next";
import { Onboarding } from "@/components/Onboarding";
import { parsePrefs } from "@/lib/onboarding";

export const metadata: Metadata = { title: "Jalan Pulang · Get started" };

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  return <Onboarding initial={parsePrefs(query)} tester={query.t === "1"} />;
}
