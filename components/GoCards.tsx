"use client";

import { useEffect, useState } from "react";
import { t, type Lang } from "@/lib/i18n";
import { googleMapsUrl, wazeLegs, telUrl } from "@/lib/deeplinks";
import { distanceAlongRoute, nextAhead, pointAt, type RouteLine } from "@/lib/route";
import { plazasAhead, quoteToll } from "@/lib/tolls";
import { track } from "@/lib/events";
import type { RnrFile, RouteConfig, Stop, TollFile } from "@/lib/schemas";
import { Facilities } from "./RoadCards";
import { Card } from "./ui/Card";
import { Source } from "./ui/Source";
import type { Replay } from "./RouteMap";

type Position = [number, number];
export type DriveMode = "idle" | "gps" | "sim" | "finished";
const plusLine = { number: "1-800-88-0000", source_url: "https://www.plus.com.my/customer-feedback/", retrieved_at: "2026-11-20" };

export function GoCards({ config, line, routeKm, rnr, tolls, entry, stops, lang, onShare, setPosition, setReplay, mode, setMode }: {
  config: RouteConfig; line: RouteLine; routeKm: number; rnr: RnrFile; tolls: TollFile;
  entry: string; stops: Stop[]; lang: Lang; onShare: () => void;
  setPosition: (point: Position | null) => void; setReplay: (replay: Replay | null) => void;
  mode: DriveMode; setMode: (mode: DriveMode) => void;
}) {

  const [currentKm, setKm] = useState<number | null>(null);
  const km = mode === "idle" ? null : currentKm;
  const [offRoute, setOffRoute] = useState(0);
  const [gpsError, setGpsError] = useState(false);
  const legs = wazeLegs(config.destination, stops);
  const destinations = [...stops, config.destination];
  const googleLegs = destinations.flatMap((_, index) => {
    if (index % 4 !== 0) return [];
    const group = destinations.slice(index, index + 4);
    return [{
      destination: group.at(-1)!,
      url: googleMapsUrl(index === 0 ? config.origin : destinations[index - 1], group.at(-1)!, group.slice(0, -1)),
    }];
  });

  useEffect(() => {
    if (mode === "sim") {
      let progress = 0;
      const update = () => {
        setKm(progress);
        setReplay({ point: pointAt(line, progress), ahead: pointAt(line, Math.min(routeKm, progress + 0.55)) });
        if (progress >= routeKm) setMode("finished");
      };
      update();
      const timer = setInterval(() => {
        progress = Math.min(routeKm, progress + 3);
        update();
      }, 650);
      return () => clearInterval(timer);
    }
    if (mode === "gps" && navigator.geolocation) {
      let active = true;
      const watch = navigator.geolocation.watchPosition(({ coords }) => {
        if (!active) return;
        const snapped = distanceAlongRoute(line, coords.longitude, coords.latitude);
        setKm(snapped.km);
        setOffRoute(snapped.offRouteM);
        setPosition(snapped.snapped);
      }, () => {
        if (!active) return;
        setGpsError(true);
        setMode("idle");
        setPosition(null);
        setKm(null);
      }, { enableHighAccuracy: true, timeout: 12_000, maximumAge: 5000 });
      return () => { active = false; navigator.geolocation.clearWatch(watch); };
    }
  }, [line, mode, routeKm, setPosition, setReplay, setMode]);

  useEffect(() => () => { setPosition(null); setReplay(null); }, [setPosition, setReplay]);

  const choose = (next: DriveMode) => {
    setKm(null);
    setPosition(null);
    setReplay(null);
    setOffRoute(0);
    setGpsError(false);
    if (next === "gps" && !navigator.geolocation) { setGpsError(true); return; }
    if (next === "sim") {
      track("sim_drive");
      window.scrollTo({ top: 0, behavior: "instant" });
    }
    setMode(next);
  };

  const nextStop = km === null ? undefined : nextAhead(rnr.items, km);
  const nextToll = km === null ? undefined : plazasAhead(tolls, km)[0];
  const toll = nextToll ? quoteToll(tolls, entry, nextToll.id) : null;

  return <section className="stack trip-content" data-testid="screen-go">
    <Card id="card-handoff" title={t(lang, "goTitle")}>
      <p>{t(lang, "goExplain")}</p>
      {googleLegs.map(({ destination, url }, index) =>
        <a className="btn" data-block="true" data-variant={index === 0 ? "primary" : undefined} data-testid="nav-google"
          key={url} href={url} target="_blank" rel="noopener noreferrer" onClick={() => track("handoff_google")}>
          {googleLegs.length === 1 ? t(lang, "navGoogle") : "Google Maps · " + t(lang, "leg", { n: index + 1, name: destination.name })}
        </a>)}
      {legs.length > 1 && <p>{t(lang, "wazeLegs")}</p>}
      {legs.map((leg) => <a className="btn" data-block="true" data-testid="nav-waze"
        key={leg.leg} href={leg.url} target="_blank" rel="noopener noreferrer" onClick={() => track("handoff_waze")}>
        {legs.length === 1 ? t(lang, "navWaze") : "Waze · " + t(lang, "leg", { n: leg.leg, name: leg.name })}
      </a>)}
      <button type="button" className="btn" onClick={onShare} data-testid="btn-share">{t(lang, "share")}</button>
    </Card>
    <Card id="card-progress" title={t(lang, "liveTitle")} source={<Source label="OpenStreetMap" ts={rnr.retrieved_at} url={rnr.source_url} lang={lang} />}>
      <p className="badge">{t(lang, "locationBadge")}</p>
      <div className="row">
        <button type="button" className="btn" aria-pressed={mode === "gps"}
          onClick={() => choose(mode === "gps" ? "idle" : "gps")}>{t(lang, mode === "gps" ? "stopGps" : "useGps")}</button>
        <button type="button" className="btn" data-testid="btn-simulate" aria-pressed={mode === "sim"}
          onClick={() => choose(mode === "sim" ? "idle" : "sim")}>{t(lang, mode === "sim" ? "stopSimulation" : "simulate")}</button>
      </div>
      {gpsError && <p role="alert">{t(lang, "gpsDenied")}</p>}
      {mode === "gps" && km === null && <p role="status">{t(lang, "loading")}</p>}
      {km !== null && <div className="stack" data-testid="drive-progress">
        {mode === "sim" && <p className="small">{t(lang, "simulation")}</p>}
        {offRoute > 1000 ? <p role="status">{t(lang, "offRoute", { n: (offRoute / 1000).toFixed(1) })}</p> : km >= routeKm - 0.1 ?
          <p role="status">{t(lang, "arrived")}</p> : <>
            <p>{t(lang, "kmFromStart", { n: km.toFixed(1) })}</p>
            {nextStop && <><p>{t(lang, "nextStop", { n: Math.ceil(nextStop.distanceAlongRoute_km - km), name: nextStop.name })}</p>
              <Facilities stop={nextStop} lang={lang} />
              <Source label={nextStop.verified ? "PLUS / OpenStreetMap" : "OpenStreetMap"} ts={nextStop.retrieved_at}
                status={nextStop.verified ? undefined : "unverified"} url={nextStop.source_url} lang={lang} />
            </>}
            {nextToll && <><p>{t(lang, "nextToll", { n: Math.ceil(nextToll.distanceAlongRoute_km - km), name: nextToll.name })}</p>
              <p>{toll?.ok ? t(lang, "tollIfExit", { n: toll.fare.toFixed(2) }) : t(lang, "tollUnknown")}</p>
              <Source label="PLUS" ts={tolls.retrieved_at} status={toll?.ok && toll.verified ? undefined : "unverified"} url={tolls.source_url} lang={lang} />
            </>}
          </>}
      </div>}
    </Card>
    <Card id="card-emergency" title={t(lang, "emergencyTitle")}
      source={<Source label="PLUS" ts={plusLine.retrieved_at} url={plusLine.source_url} lang={lang} />}>
      <a className="btn" href={telUrl(plusLine.number)}>PLUSLine {plusLine.number}</a>
    </Card>
  </section>;
}
