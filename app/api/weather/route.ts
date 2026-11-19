import { NextResponse } from "next/server";
import { cachedFetch, cdnHeaders } from "@/lib/cache";
import { MetForecasts, MetWarnings } from "@/lib/schemas";
import { getRoute } from "@/lib/data";
import { corridorForecast, matchWarnings } from "@/lib/weather";
import { myDate } from "@/lib/prayer";

export const dynamic = "force-dynamic";
const TTL = 5 * 60_000;
const FIXTURE_AT = "2026-11-20T01:02:00+08:00";

export async function GET(req: Request) {
  const u = new URL(req.url);
  const r = getRoute(u.searchParams.get("route") ?? undefined);
  const date = u.searchParams.get("date") ?? myDate(new Date());

  const [warn, fc] = await Promise.all([
    cachedFetch({
      key: "met-warning", url: "https://api.data.gov.my/weather/warning/?limit=50", ttlMs: TTL, schema: MetWarnings,
      fixture: () => import("@/fixtures/weather-warning.json").then((m) => m.default), fixtureFetchedAt: FIXTURE_AT,
    }),
    cachedFetch({
      key: "met-forecast", url: "https://api.data.gov.my/weather/forecast/?limit=2000", ttlMs: TTL, schema: MetForecasts,
      fixture: () => import("@/fixtures/weather-forecast.json").then((m) => m.default), fixtureFetchedAt: FIXTURE_AT,
    }),
  ]);

  const warnings = matchWarnings(warn.data, r.gazetteer);
  const forecast = corridorForecast(fc.data, r.gazetteer, date);
  return NextResponse.json(
    {
      source: "MET Malaysia via data.gov.my",
      matching: "best-effort (warnings are text, matched by district/state name)",
      warnings: { items: warnings, status: warn.status, fetchedAt: warn.fetchedAt, fixture: !!warn.fixture },
      forecast: { date, items: forecast, status: fc.status, fetchedAt: fc.fetchedAt, fixture: !!fc.fixture },
    },
    { headers: cdnHeaders(300) },
  );
}
