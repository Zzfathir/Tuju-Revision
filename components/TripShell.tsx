"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { t, type Lang } from "@/lib/i18n";
import type { EtaGrid } from "@/lib/eta-grid";
import type { Prefs } from "@/lib/onboarding";
import type { Place } from "@/lib/places";
import type { RouteOption } from "@/lib/routing";
import { readRecents, saveRecent } from "@/lib/recents";
import type { Stop } from "@/lib/schemas";
import { buildTripRoute, type CuratedBundle, type TripRoute } from "@/lib/trip-route";
import { isDefaultTrip, tripParams, type Endpoints } from "@/lib/trip-url";
import { PlaceSearch } from "./PlaceSearch";
import { RouteCard } from "./RouteCard";
import { RouteOptions } from "./RouteOptions";
import { Trip } from "./Trip";
import { RouteMap } from "./RouteMap";

type Status = "idle" | "loading" | "same" | "no-route" | "busy" | "unavailable";
type Fetched = { key: string; routes: RouteOption[]; source: string; fetchedAt: string };
const NO_STOPS: Stop[] = [];

const km = (a: Place, b: Place) => {
  const rad = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
};
const message = { same: "routeSame", "no-route": "routeNone", busy: "routeBusy", unavailable: "routeUnavailable" } as const;

export function TripShell({ curated, eta, routeKm, date, tester, initial, start, startOnMap }: {
  curated: CuratedBundle; eta?: EtaGrid; routeKm: number; date: string; tester: boolean; initial: Prefs; start: Endpoints;
  startOnMap: boolean;
}) {
  const defaults = useMemo<Endpoints>(() => ({
    from: { id: "default-from", detail: "", ...curated.config.origin },
    to: { id: "default-to", detail: "", ...curated.config.destination },
  }), [curated]);
  const [from, setFrom] = useState<Place>(start.from);
  const [to, setTo] = useState<Place>(start.to);
  const [open, setOpen] = useState<null | "from" | "to">(null);
  const [fetched, setFetched] = useState<Fetched | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [choice, setChoice] = useState(0);
  const [recentPlace, setRecentPlace] = useState<string>();
  const lastTrips = useRef<TripRoute[]>([]);

  const isDefault = isDefaultTrip(from, to, defaults);
  const key = `${from.lat},${from.lng}>${to.lat},${to.lng}`;

  useEffect(() => {
    if (isDefault) { setStatus("idle"); return; }
    if (km(from, to) < 2) { setStatus("same"); return; }
    if (fetched?.key === key) { setStatus("idle"); return; }
    const controller = new AbortController();
    setStatus("loading");
    fetch(`/api/route?from=${from.lat},${from.lng}&to=${to.lat},${to.lng}`, { signal: controller.signal })
      .then(async (response) => {
        if (controller.signal.aborted) return;
        if (response.ok) {
          const body: { routes: RouteOption[]; source: string; fetchedAt: string } = await response.json();
          setFetched({ key, routes: body.routes, source: body.source, fetchedAt: body.fetchedAt });
          setChoice(0);
          setStatus("idle");
        } else setStatus(response.status === 404 ? "no-route" : response.status === 429 ? "busy" : "unavailable");
      })
      .catch(() => { if (!controller.signal.aborted) setStatus("unavailable"); });
    return () => controller.abort();
  }, [key, isDefault]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the address bar in step with the trip so a reload or a shared link restores it.
  useEffect(() => {
    const url = new URL(window.location.href);
    for (const name of ["from", "fromName", "to", "toName"]) url.searchParams.delete(name);
    for (const [name, value] of Object.entries(tripParams(from, to, defaults))) url.searchParams.set(name, value);
    window.history.replaceState(null, "", url);
  }, [from, to, defaults]);

  const curatedTrip = useMemo<TripRoute>(() => ({
    key: curated.config.id, config: curated.config, line: curated.line, rnr: curated.rnr, tolls: curated.tolls, routeKm,
    curated: true, hasVerifiedStops: true, corridorWeather: true, tollPartial: false, source: "OSRM / OpenStreetMap",
  }), [curated, routeKm]);

  const trips = useMemo<TripRoute[]>(() => {
    if (isDefault) return [curatedTrip];
    if (fetched?.key !== key) return [];
    return fetched.routes.map((option) => buildTripRoute({ from, to, option, source: fetched.source, fetchedAt: fetched.fetchedAt, curated }));
  }, [curated, curatedTrip, fetched, from, isDefault, key, to]);
  if (trips.length) lastTrips.current = trips;

  const failed = status === "same" || status === "no-route" || status === "busy" || status === "unavailable";
  // While a new trip loads the previous one stays on screen. After a failure nothing stale is shown.
  const shown = trips.length ? trips : status === "loading" ? lastTrips.current : [];
  const trip = shown[Math.min(choice, Math.max(0, shown.length - 1))];

  const choose = (place: Place) => {
    if (open === "from") setFrom(place); else setTo(place);
    saveRecent(place);
    setRecentPlace(place.name);
    setOpen(null);
    setChoice(0);
  };
  useEffect(() => { setRecentPlace(readRecents()[0]?.name); }, []);
  const swap = () => { setFrom(to); setTo(from); setChoice(0); };
  const directions = `https://www.google.com/maps/dir/?api=1&origin=${from.lat},${from.lng}&destination=${to.lat},${to.lng}&travelmode=driving`;

  const statusLine = (lang: Lang) => status === "loading" ? <p className="route-status" role="status">{t(lang, "routeFinding")}</p>
    : failed ? <div className="route-status" data-testid="route-error" role="alert">
      <p>{t(lang, message[status as keyof typeof message])}</p>
      {status !== "no-route" && status !== "same" && <a className="btn" data-size="sm" href={directions}>{t(lang, "openInGoogleMaps")}</a>}
    </div> : null;

  const card = (lang: Lang) => <RouteCard lang={lang} from={from} to={to} onOpen={setOpen} onSwap={swap}>{statusLine(lang)}</RouteCard>;
  const overlay = (lang: Lang) => open ? <PlaceSearch lang={lang} field={open} onPick={choose} onClose={() => setOpen(null)}
    savedCandidates={curated.rnr.items} /> : null;

  if (!trip) {
    return <main className="app road-ui app-empty" lang={initial.lang} data-testid="screen-plan-empty">
      <div className="map-stage empty-stage">
        <RouteMap line={curated.line} stops={NO_STOPS} driveFrame={null} simulated={false} lang={initial.lang}
          places={[curated.config.origin.name, curated.config.destination.name]} online={typeof navigator === "undefined" || navigator.onLine}
          selectedStopId={null} browsing={false} startNorthUp showRoute={false} />
        {card(initial.lang)}
      </div>
      {overlay(initial.lang)}
    </main>;
  }

  const summaries = shown.map((item) => ({
    id: item.key, verified: item.curated,
    duration_s: Number(item.line.properties?.duration_s_freeflow) || (item.routeKm / 80) * 3600,
    distance_m: Number(item.line.properties?.distance_m) || item.routeKm * 1000,
  }));

  return <Trip key={trip.key} config={trip.config} line={trip.line} rnr={trip.rnr} tolls={trip.tolls} routeKm={trip.routeKm}
    date={date} tester={tester} initial={initial} hasVerifiedStops={trip.hasVerifiedStops} tollPartial={trip.tollPartial}
    eta={isDefault ? eta : undefined} weatherRouteId={trip.corridorWeather ? curated.config.id : null}
    routeCard={card} overlay={overlay} startOnMap={startOnMap && isDefault} onSearchDestination={() => setOpen("to")} recentPlace={recentPlace}
    onPlanToStop={(stop) => { setTo({ id: stop.id, name: stop.name, detail: "Rest area", lat: stop.lat, lng: stop.lng }); setChoice(0); }}
    alternativeLines={shown.length > 1 ? shown.filter((item) => item !== trip).map((item) => item.line) : undefined}
    routeOptions={shown.length > 1 ? (lang) => <RouteOptions lang={lang} options={summaries} selected={Math.min(choice, shown.length - 1)} onSelect={setChoice} /> : undefined} />;
}
