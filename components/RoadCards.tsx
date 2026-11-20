import type { ReactNode } from "react";
import { Card } from "./ui/Card";
import { Source } from "./ui/Source";
import type { DayTimes, PrayerSource } from "@/lib/prayer";
import type { CorridorWarning } from "@/lib/weather";
import type { FacilityKey, Stop } from "@/lib/schemas";
import type { PlannedStop } from "@/lib/planner";
import { fmtTime, forecastSummary, t, type Key, type Lang } from "@/lib/i18n";
import { searchTerms, searchUrl } from "@/lib/breaks";
import type { Need } from "@/lib/planner";

export type WeatherResponse = {
  source: string;
  warnings: { items: CorridorWarning[]; status: "live" | "cached"; fetchedAt: string; fixture: boolean };
  forecast: { date: string; items: {
    location: { location_id: string; location_name: string };
    summary_forecast: string; min_temp: number; max_temp: number;
  }[]; status: "live" | "cached"; fetchedAt: string; fixture: boolean };
};
export type PrayerResponse = { date: string; zone: string; times: Omit<DayTimes, "date" | "zone">; source: PrayerSource };

export function Facilities({ stop, lang }: { stop: Stop; lang: Lang }) {
  return <div className="row">{(Object.entries(stop.facilities) as [FacilityKey, boolean | null][]).map(([name, value]) =>
    <span className="badge" data-on={String(value)} key={name}>{t(lang, name)}{value === null ? " ?" : ""}</span>
  )}</div>;
}

export function StopCard({ stop, planned, lang, onShow }: { stop: Stop; planned?: PlannedStop; lang: Lang; onShow?: () => void }) {
  const reasonText = (reason: string) => {
    if (reason.startsWith("pray:")) return t(lang, "reason_pray", { p: reason.slice(5) });
    const key = ({ charge: "reason_charge", refuel: "reason_refuel", break: "reason_break", ev: "evCharger" } as Record<string, Key>)[reason];
    return t(lang, key ?? reason as Key);
  };
  return <Card id="card-stop" title={stop.name} source={<Source label={stop.verified ? "PLUS / OpenStreetMap" : "OpenStreetMap"}
    ts={stop.retrieved_at} status={stop.verified ? undefined : "unverified"} url={stop.source_url} lang={lang} />}>
    <p className="small">{t(lang, "kmFromStart", { n: stop.distanceAlongRoute_km })}</p>
    {planned && <p>{t(lang, "stopAt", {
      t: fmtTime(planned.arrive), m: Math.round((planned.depart.getTime() - planned.arrive.getTime()) / 60_000),
    })} · {planned.reasons.map(reasonText).join(", ")}</p>}
    <Facilities stop={stop} lang={lang} />
    {onShow && <button type="button" className="btn" data-size="sm" data-testid="stop-show-on-map" onClick={onShow}>{t(lang, "showOnMap")}</button>}
  </Card>;
}

/** An evenly spaced rest point on a road with no verified stops. We say where to look, never what is there. */
export function BreakCard({ stop, planned, needs, lang, onShow }: {
  stop: Stop; planned: PlannedStop; needs: Partial<Record<Need, boolean>>; lang: Lang; onShow?: () => void;
}) {
  const number = stop.id.replace("break-", "");
  return <Card id="card-break" title={t(lang, "breakAt", { n: number })}>
    <p className="small">{t(lang, "kmFromStart", { n: stop.distanceAlongRoute_km })}</p>
    <p>{t(lang, "stopAt", { t: fmtTime(planned.arrive), m: Math.round((planned.depart.getTime() - planned.arrive.getTime()) / 60_000) })}</p>
    <p className="small">{t(lang, "searchNearby")}</p>
    <div className="row">{searchTerms(needs).map((term) => <a key={term} className="chip chip-link" data-testid="break-search"
      href={searchUrl(term, stop.lat, stop.lng)} target="_blank" rel="noopener noreferrer">{term}</a>)}</div>
    {onShow && <button type="button" className="btn" data-size="sm" data-testid="stop-show-on-map" onClick={onShow}>{t(lang, "showOnMap")}</button>}
  </Card>;
}

export function WeatherCard({ data, loading, retry, now, lang, offline, noCoverage = false }: {
  data: WeatherResponse | null; loading: boolean; retry: () => void; now: number; lang: Lang; offline: boolean; noCoverage?: boolean;
}) {
  const weatherUrl = "https://data.gov.my/data-catalogue/weather_warning";
  const freshness = 15 * 60_000;
  if (noCoverage) return <Card id="card-weather" title={t(lang, "weatherTitle")} state="empty">
    <p>{t(lang, "weatherNoCoverage")}</p>
    <a className="btn" data-size="sm" href="https://www.met.gov.my/" target="_blank" rel="noopener noreferrer">MET Malaysia</a>
  </Card>;
  return <Card id="card-weather" title={t(lang, "weatherTitle")}
    state={loading ? "loading" : !data ? "error" : offline ? "offline" : now - Date.parse(data.warnings.fetchedAt) > freshness ? "stale" : "default"}>
    {loading ? <p role="status">{t(lang, "loading")}</p> : !data ? <>
      <p>{t(lang, "unavailable")}</p>
      <button type="button" className="btn" onClick={retry}>{t(lang, "retry")}</button>
    </> : <>
      <Source label={data.source} url={weatherUrl} ts={data.warnings.fetchedAt}
        status={offline ? "cached" : data.warnings.status} now={now} maxAge={freshness} lang={lang} />
      {!data.warnings.items.length && <p>{!offline && data.warnings.status === "live" && now - Date.parse(data.warnings.fetchedAt) <= freshness
        ? t(lang, "weatherNone") : t(lang, "weatherCachedNone")}</p>}
      {data.warnings.items.length > 0 && <ul className="list">{data.warnings.items.map((warning, index) =>
        <li className="banner" data-kind="warning" key={warning.issued + index}>
          <strong>{lang === "bm" ? warning.title_bm : warning.title_en}</strong>
          <p>{warning.matched.join(", ")}</p>
          <Source label={t(lang, "issued")} ts={warning.issued.replace(" ", "T") + (/Z$|[+-]\d\d:\d\d$/.test(warning.issued) ? "" : "+08:00")} lang={lang} />
          {warning.text_en && <p className="small">{lang === "bm" ? warning.text_bm : warning.text_en}</p>}
        </li>)}</ul>}
      <p className="small">{t(lang, "weatherBestEffort")}</p>
      <h4>{t(lang, "forecastFor", { d: data.forecast.date })}</h4>
      <Source label={data.source} ts={data.forecast.fetchedAt} status={offline ? "cached" : data.forecast.status}
        now={now} maxAge={freshness} url="https://data.gov.my/data-catalogue/weather_forecast" lang={lang} />
      {data.forecast.items.length ? <ul className="list">{data.forecast.items.map((item) =>
        <li key={item.location.location_id}>{item.location.location_name} · {forecastSummary(lang, item.summary_forecast)} · {item.min_temp}–{item.max_temp} °C</li>
      )}</ul> : <p>{t(lang, "forecastNone")}</p>}
    </>}
  </Card>;
}

export function PrayerCard({ data, loading, now, lang, retry, noCoverage = false }: {
  data: PrayerResponse[]; loading: boolean; now: number; lang: Lang; retry: () => void; noCoverage?: boolean;
}) {
  if (noCoverage) return <Card id="card-prayer" title={t(lang, "prayerTitle")} state="empty">
    <p>{t(lang, "prayerNoCoverage")}</p>
    <a className="btn" data-size="sm" href="https://www.e-solat.gov.my/" target="_blank" rel="noopener noreferrer">JAKIM e-Solat</a>
  </Card>;
  let body: ReactNode;
  if (loading) body = <p role="status">{t(lang, "loading")}</p>;
  else if (!data.length) body = <><p>{t(lang, "unavailable")}</p><button type="button" className="btn" onClick={retry}>{t(lang, "retry")}</button></>;
  else body = <><p className="small">{t(lang, "zonesNote")}</p>
    {data.map(({ zone, times, source }) => <div key={zone} className="stack">
      <p><strong>{zone}</strong> · Zohor {times.dhuhr} · Asar {times.asr} · Maghrib {times.maghrib}</p>
      <Source label={source.status === "estimate" ? t(lang, "approxPrayer") : "JAKIM e-Solat"} ts={source.fetchedAt}
        status={source.status} now={now} maxAge={2 * 86_400_000} url="https://www.e-solat.gov.my/" lang={lang} />
    </div>)}</>;
  return <Card id="card-prayer" title={t(lang, "prayerTitle")} state={loading ? "loading" : data.length ? "default" : "error"}>{body}</Card>;
}
