"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { prefsQuery, type Prefs } from "@/lib/onboarding";
import { t, fmtDur, fmtTime, type Lang } from "@/lib/i18n";
import { planStops, type Need } from "@/lib/planner";
import { APPROX, windowsFor } from "@/lib/prayer";
import { track } from "@/lib/events";
import { quoteToll } from "@/lib/tolls";
import { downloadSnapshot, storeSnapshot, type Snapshot } from "@/lib/trip-card";
import type { RnrFile, RouteConfig, TollFile } from "@/lib/schemas";
import type { EtaGrid } from "@/lib/eta-grid";
import type { RouteLine } from "@/lib/route";
import { LeaveTimeBar, TollPicker } from "./PlanCards";
import { PrayerCard, StopCard, WeatherCard, type PrayerResponse, type WeatherResponse } from "./RoadCards";
import { RouteMap, type Replay } from "./RouteMap";

import { groupCopy } from "@/lib/group-copy";
import { GoCards, type DriveMode } from "./GoCards";
import { TesterTasks } from "./TesterTasks";
import { Card } from "./ui/Card";
import { Source } from "./ui/Source";

const needsList = ["toilet", "surau", "ev", "food", "fuel"] as const;
const steps = ["stepPlan", "stepRoad", "stepGo"] as const;
const FIVE_MINUTES = 300_000;

async function request<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error("Request failed");
  return response.json();
}

export function Trip({ config, line, rnr, tolls, routeKm, date, tester, eta, initial }: {
  config: RouteConfig; line: RouteLine; rnr: RnrFile; tolls: TollFile;
  routeKm: number; date: string; tester: boolean; eta?: EtaGrid; initial: Prefs;
}) {
  const [lang, setLang] = useState<Lang>(initial.lang);
  const [step, setStep] = useState(0);
  const [departure, setDeparture] = useState(date + "T09:00");
  const [vehicle, setVehicle] = useState<"petrol" | "ev">(initial.vehicle);
  const [range, setRange] = useState(initial.vehicle === "ev" ? "250" : "500");
  const [maxDrive, setMaxDrive] = useState(120);
  const [needs, setNeeds] = useState<Partial<Record<Need, boolean>>>(() => Object.fromEntries(initial.needs.map((need) => [need, true])));
  const [prayerAware, setPrayerAware] = useState(false);
  const routeEntry = tolls.plazas[0]?.id ?? "";
  const routeExit = tolls.plazas.at(-1)?.id ?? "";
  const [entry, setEntry] = useState(routeEntry);
  const [exit, setExit] = useState(routeExit);
  const selectedDate = departure.slice(0, 10);
  const [now, setNow] = useState(0);
  const [online, setOnline] = useState(true);
  const [weatherResult, setWeatherResult] = useState<{ date: string; data: WeatherResponse | null }>();
  const [prayerResult, setPrayerResult] = useState<{ date: string; data: PrayerResponse[] }>();
  const [weatherAttempt, setWeatherAttempt] = useState(0);
  const [prayerAttempt, setPrayerAttempt] = useState(0);
  const [position, setPosition] = useState<[number, number] | null>(null);
  const [replay, setReplay] = useState<Replay | null>(null);
  const [driveMode, setDriveMode] = useState<DriveMode>("idle");
  const sheet = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const visited = useRef(false);
  const weather = weatherResult?.date === selectedDate ? weatherResult.data : null;
  const prayers = useMemo(() => prayerResult?.date === selectedDate ? prayerResult.data : [], [prayerResult, selectedDate]);

  useEffect(() => {
    if (!visited.current) { visited.current = true; track("visit"); }
    const update = () => { setOnline(navigator.onLine); setNow(Date.now()); };
    const reconnect = () => { update(); setWeatherAttempt((n) => n + 1); setPrayerAttempt((n) => n + 1); };
    update();
    window.addEventListener("online", reconnect);
    window.addEventListener("offline", update);
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => {
      clearInterval(timer);
      window.removeEventListener("online", reconnect);
      window.removeEventListener("offline", update);
    };
  }, []);

  const roadOpen = step > 0;
  useEffect(() => {
    if (!roadOpen) return;
    const controller = new AbortController();
    const loadWeather = () => {
      const query = new URLSearchParams({ route: config.id, date: selectedDate });
      request<WeatherResponse>("/api/weather?" + query, controller.signal)
        .then((data) => { if (!controller.signal.aborted) setWeatherResult({ date: selectedDate, data }); })
        .catch(() => { if (!controller.signal.aborted) setWeatherResult((previous) => previous?.date === selectedDate && previous.data ? previous : { date: selectedDate, data: null }); });
    };
    loadWeather();
    const timer = setInterval(loadWeather, FIVE_MINUTES);
    return () => { controller.abort(); clearInterval(timer); };
  }, [roadOpen, config.id, selectedDate, weatherAttempt]);

  useEffect(() => {
    if (!prayerAware) return;
    const controller = new AbortController();
    const zones = [...new Set(config.prayerZones.map(({ zone }) => zone))];
    Promise.all(zones.map(async (zone) => {
      const query = new URLSearchParams({ zone, date: selectedDate });
      try {
        return await request<PrayerResponse>("/api/prayer?" + query, controller.signal);
      } catch {
        const times = APPROX[zone];
        return times ? { date: selectedDate, zone, times, source: { label: "Approximate table", status: "estimate" as const, fetchedAt: "2026-11-20" } } : null;
      }
    })).then((data) => {
      if (!controller.signal.aborted) setPrayerResult({ date: selectedDate, data: data.filter((item) => item !== null) });
    });
    return () => controller.abort();
  }, [config.prayerZones, prayerAware, selectedDate, prayerAttempt]);

  const prayerLoading = prayerAware && prayerResult?.date !== selectedDate;
  const weatherLoading = weatherResult?.date !== selectedDate;
  const baseMinutes = Number(line.properties?.duration_s_freeflow) / 60 || routeKm / 90 * 60;
  const plan = useMemo(() => {
    if (prayerLoading) return null;
    const byZone = prayers.map(({ zone, date: prayerDate, times }) => windowsFor({ zone, date: prayerDate, ...times }));
    const prayerWindows = byZone[0]?.map(({ name }, index) => ({
      name,
      start: new Date(Math.max(...byZone.map((windows) => windows[index].start.getTime()))),
      end: new Date(Math.min(...byZone.map((windows) => windows[index].end.getTime()))),
    }));
    return planStops({
      stops: rnr.items, routeKm, departureTime: new Date(departure + ":00+08:00"),
      avgSpeedKmh: routeKm * 60 / baseMinutes, vehicleType: vehicle, range_km: Number(range),
      maxDrivingMinutes: maxDrive, needs, prayerAware, prayerWindows,
    });
  }, [baseMinutes, departure, maxDrive, needs, prayerAware, prayerLoading, prayers, range, rnr.items, routeKm, vehicle]);

  const move = (target: number) => {
    if (target === 2) track("plan_made");
    if (target !== 2) {
      setPosition(null);
      setReplay(null);
      setDriveMode("idle");
    }
    setStep(target);
    requestAnimationFrame(() => {
      sheet.current?.scrollIntoView({ block: "start" });
      heading.current?.focus({ preventScroll: true });
    });
  };

  const share = () => {
    if (!plan?.ok) return;
    const quote = quoteToll(tolls, routeEntry, routeExit);
    const current = online && weather && weather.warnings.status === "live" && now - Date.parse(weather.warnings.fetchedAt) <= 15 * 60_000;
    const snapshot: Snapshot = {
      route: config.name[lang], departure: departure.replace("T", " ") + " MYT",
      toll: quote.ok ? t(lang, "tollTotal", { n: quote.fare.toFixed(2) }) : t(lang, "tollUnknown"),
      stops: plan.stops.map(({ stop }) => stop.name),
      weather: t(lang, !weather ? "unavailable" : !current ? "weatherSnapshotCached" :
        weather.warnings.items.length ? "weatherSnapshotWarning" : "weatherNone"),
      lang,
    };
    if (storeSnapshot(snapshot)) window.location.assign("/share");
    else void downloadSnapshot(snapshot);
  };

  const offlineDate = [weather?.warnings.fetchedAt, weather?.forecast.fetchedAt, rnr.retrieved_at, tolls.retrieved_at]
    .filter((value): value is string => Boolean(value && Number.isFinite(Date.parse(value))))
    .sort((a, b) => Date.parse(b) - Date.parse(a))[0];

  const routeQuote = quoteToll(tolls, routeEntry, routeExit);
  const [origin, destination] = config.name[lang].split(" → ");
  return <main className="app" lang={lang}>
    <div className="map-stage">
      <RouteMap line={line} stops={rnr.items} position={position} replay={replay} replayFinished={driveMode === "finished"} lang={lang}
        places={[origin ?? config.origin.name, destination ?? config.destination.name]} online={online}
        preview={config.id === "kl-ipoh" && !process.env.NEXT_PUBLIC_TILE_URL ? "/kl-ipoh-drive-preview.webp" : undefined} />
      <header className="map-masthead">
        <h1><a href={"/" + prefsQuery({ lang }, tester ? { t: "1" } : {})} className="home-link">{t(lang, "appName")}</a></h1>
        <button type="button" className="btn language-button" data-testid="btn-lang"
          aria-label={t(lang, "langToggle")} onClick={() => setLang(lang === "en" ? "bm" : "en")}>{lang === "en" ? "BM" : "EN"}</button>
      </header>
    </div>
    <div className="panel" ref={sheet}>
      <ol className="step-progress" aria-label={t(lang, "steps")}>
        {steps.map((name, index) => <li key={name} aria-current={index === step ? "step" : undefined}
          data-reached={index <= step}>{index < step
            ? <button type="button" onClick={() => move(index)}>{t(lang, name)}</button>
            : <span>{t(lang, name)}</span>}</li>)}
      </ol>
      <h2 ref={heading} tabIndex={-1} className="sr-only">{t(lang, steps[step])}</h2>
      <header className="trip-heading">
        <p className="trip-highway">{config.highway.replace(/northbound$/i, t(lang, "northbound"))}</p>
        <p className="trip-title">{config.name[lang]}</p>
        <dl className="trip-metrics">
          <div><dt>{t(lang, "distance")}</dt><dd>{Math.round(routeKm)} km</dd></div>
          <div><dt>{t(lang, "estimatedDrive")}</dt><dd>{fmtDur(baseMinutes)}</dd></div>
          <div><dt>{t(lang, "classOneToll")}</dt><dd>{routeQuote.ok ? "RM " + routeQuote.fare.toFixed(2) : "—"}</dd></div>
        </dl>
      </header>
      {!online && <p className="banner" data-kind="offline" role="status">{t(lang, "offline", { t: offlineDate ? offlineDate.slice(0, 10) + " " + fmtTime(new Date(offlineDate)) + " MYT" : "—" })}</p>}
      {tester && <TesterTasks lang={lang} />}
      {step === 0 && <section className="stack trip-content" data-testid="screen-plan">
        <div className="row trip-details-header">
          <h3 className="grow">{t(lang, "tripDetails")}</h3>
          <a href={"/group-arrival" + (lang === "bm" ? "?lang=bm" : "")} className="btn">{groupCopy(lang, "title")}</a>
        </div>
        <div className="trip-fields">
        <label className="field">{t(lang, "departure")} (MYT)
          <input className="input" type="datetime-local" data-testid="departure" value={departure}
            onChange={(event) => { if (event.target.value && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(event.target.value)) setDeparture(event.target.value); }} />
        </label>
        <label className="field">{t(lang, "vehicle")}
          <select className="select" value={vehicle} onChange={(event) => {
            const value = event.target.value === "ev" ? "ev" : "petrol";
            setVehicle(value);
            setRange(value === "ev" ? "250" : "500");
          }}><option value="petrol">{t(lang, "petrol")}</option><option value="ev">{t(lang, "ev")}</option></select>
        </label>
        <label className="field">{t(lang, "range")}
          <input className="input" type="number" min="1" max="2000" required value={range} onChange={(event) => setRange(event.target.value)} />
        </label>
        <label className="field">{t(lang, "maxDrive")}
          <select className="select" value={maxDrive} onChange={(event) => setMaxDrive(Number(event.target.value))}>
            {[60, 90, 120, 150, 180].map((n) => <option key={n} value={n}>{t(lang, "minutes", { n })}</option>)}
          </select>
        </label>
        </div>
        <fieldset className="trip-needs"><legend>{t(lang, "needs")}</legend>
          {needsList.map((need) => <label className="check" key={need}>
            <input type="checkbox" checked={Boolean(needs[need])} data-testid={"need-" + need}
              onChange={(event) => setNeeds({ ...needs, [need]: event.target.checked })} />
            {t(lang, need === "ev" ? "evCharger" : need)}
          </label>)}
        </fieldset>
        <label className="check"><input type="checkbox" checked={prayerAware} onChange={(event) => setPrayerAware(event.target.checked)} />{t(lang, "prayerAware")}</label>
        <TollPicker {...{ tolls, entry, exit, setEntry, setExit, lang }} />
        <LeaveTimeBar {...{ config, departure, setDeparture, baseMinutes, eta, lang }} />
      </section>}
      {step === 1 && <section className="stack trip-content" data-testid="screen-road">
        <Card id="card-plan" title={t(lang, "planTitle")}
          source={<Source label="Jalan Pulang / OpenStreetMap" status="estimate" ts={rnr.retrieved_at} lang={lang} />}
          state={!plan ? "loading" : !plan.ok ? "error" : plan.stops.length ? "default" : "empty"}>
          {!plan ? <p role="status">{t(lang, "loading")}</p> : !plan.ok ? <><p><strong>{t(lang, "infeasible")}</strong></p>
            <p>{t(lang, ("plan_" + plan.reason) as "plan_range" | "plan_max-driving" | "plan_needs" | "plan_prayer" | "plan_no-stops")}</p></> : <>
            <p>{t(lang, "arrive", { t: fmtTime(plan.arrival) })} MYT · {t(lang, "totalTime", { d: fmtDur(plan.totalMinutes) })}</p>
            {plan.stops.length ? <ul className="list">{plan.stops.map((item) => <li key={item.stop.id}><StopCard stop={item.stop} planned={item} lang={lang} /></li>)}</ul> :
              <p>{t(lang, "planNone")}</p>}
            {prayerAware && <p className="small">{t(lang, "prayerPlanningNote")}</p>}
          </>}
        </Card>
        {prayerAware && <PrayerCard data={prayers} loading={prayerLoading} now={now} lang={lang}
          retry={() => { setPrayerResult(undefined); setPrayerAttempt((n) => n + 1); }} />}
        <WeatherCard data={weather} loading={weatherLoading} now={now} lang={lang} offline={!online}
          retry={() => { setWeatherResult(undefined); setWeatherAttempt((n) => n + 1); }} />
        <h3>{t(lang, "allStops")}</h3>
        <p className="small">{t(lang, "facilitiesUnknown")}</p>
        <ul className="list">{rnr.items.map((stop) => <li key={stop.id}><StopCard {...{ stop, lang }} /></li>)}</ul>
      </section>}
      {step === 2 && plan?.ok && <GoCards {...{ config, line, rnr, tolls, routeKm, lang, setPosition, setReplay }} entry={routeEntry} mode={driveMode} setMode={setDriveMode}
        stops={plan.stops.map(({ stop }) => stop)} onShare={share} />}
      {step < 2 && <nav className="step-nav" aria-label={t(lang, "steps")}>
        {step > 0 && <button type="button" className="btn" data-testid="btn-back" onClick={() => move(0)}>{t(lang, "back")}</button>}
        <button type="button" className="btn" data-variant="primary" data-testid="btn-next" onClick={() => move(step + 1)}
          disabled={step === 0 ? Number(range) < 1 || Number(range) > 2000 : !plan?.ok}>
          {t(lang, step === 0 ? "reviewRoute" : "continueToGo")} <span aria-hidden="true">→</span>
        </button>
      </nav>}
      {step === 2 && <nav className="step-nav" aria-label={t(lang, "steps")}>
        <button type="button" className="btn" data-testid="btn-back" onClick={() => move(1)}>{t(lang, "back")}</button>
        {(driveMode === "sim" || driveMode === "finished") && <button type="button" className="btn" data-variant="primary" data-testid="btn-stop-replay"
          onClick={() => { setDriveMode("idle"); setReplay(null); }}>{t(lang, driveMode === "finished" ? "endSimulation" : "stopSimulation")}</button>}
      </nav>}
      <footer className="stack foot trip-footer">
        <p>{t(lang, "tagline")}</p>
        <div className="row"><a href={"/about?lang=" + lang}>{t(lang, "dataPrivacy")}</a><a href="/qr">{t(lang, "testerQr")}</a></div>
        <div className="row">
          <Source label="OSRM / OpenStreetMap" ts={String(line.properties?.retrieved_at ?? "")}
            url={String(line.properties?.source_url ?? "https://www.openstreetmap.org/")} lang={lang} />
          {routeQuote.ok && <Source label="PLUS" ts={tolls.retrieved_at} url={tolls.source_url}
            status={routeQuote.verified ? undefined : "unverified"} lang={lang} />}
        </div>
      </footer>
    </div>
  </main>;
}
