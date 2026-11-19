import { NextResponse } from "next/server";
import { cachedFetch, cdnHeaders } from "@/lib/cache";
import { ESolat } from "@/lib/schemas";
import { APPROX, esolatDateToIso, myDate } from "@/lib/prayer";

export const dynamic = "force-dynamic";
const ZONES = new Set(["WLY01", "SGR01", "PRK02"]);
const fixtures: Record<string, () => Promise<unknown>> = {
  WLY01: () => import("@/fixtures/esolat-month-WLY01.json").then((m) => m.default),
  SGR01: () => import("@/fixtures/esolat-month-SGR01.json").then((m) => m.default),
  PRK02: () => import("@/fixtures/esolat-month-PRK02.json").then((m) => m.default),
};

export async function GET(req: Request) {
  const u = new URL(req.url);
  const zone = u.searchParams.get("zone") ?? "PRK02";
  const date = u.searchParams.get("date") ?? myDate(new Date());
  if (!ZONES.has(zone)) return NextResponse.json({ error: "unsupported zone" }, { status: 400 });

  const res = await cachedFetch({
    key: `esolat-${zone}`,
    url: `https://www.e-solat.gov.my/index.php?r=esolatApi/takwimsolat&period=month&zone=${zone}`,
    ttlMs: 24 * 3600_000, schema: ESolat, fixture: fixtures[zone], fixtureFetchedAt: "2026-11-20T01:10:00+08:00",
  });
  const day = res.data.prayerTime.find((p) => esolatDateToIso(p.date) === date);
  if (day) {
    const t = (s: string) => s.slice(0, 5);
    return NextResponse.json(
      { zone, date, times: { fajr: t(day.fajr), dhuhr: t(day.dhuhr), asr: t(day.asr), maghrib: t(day.maghrib), isha: t(day.isha) },
        source: { label: "JAKIM e-Solat", status: res.status, fetchedAt: res.fetchedAt } },
      { headers: cdnHeaders(3600) },
    );
  }
  // requested date outside the fetched month → labelled approximation
  return NextResponse.json(
    { zone, date, times: APPROX[zone], source: { label: "Approximate table (e-Solat unavailable for this date)", status: "estimate", fetchedAt: "2026-11-20" } },
    { headers: cdnHeaders(3600) },
  );
}
