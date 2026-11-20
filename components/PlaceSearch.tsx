"use client";

import { useEffect, useRef, useState } from "react";
import { inMalaysia } from "@/lib/bounds";
import { t, type Lang } from "@/lib/i18n";
import { POPULAR, searchFallback, type Place } from "@/lib/places";
import { readRecents } from "@/lib/recents";
import { parseRoadGame, ROAD_GAME_KEY } from "@/lib/road-game";
import type { Stop } from "@/lib/schemas";

type Found = { places: Place[]; approx: boolean };

export function PlaceSearch({ lang, field, onPick, onClose, savedCandidates }: {
  lang: Lang; field: "from" | "to"; onPick: (place: Place) => void; onClose: () => void; savedCandidates?: Stop[];
}) {
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<Found | null>(null);
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationFailed, setLocationFailed] = useState(false);
  const [recents] = useState<Place[]>(() => readRecents());
  const [saved] = useState<Place[]>(() => {
    try {
      const { saved } = parseRoadGame(localStorage.getItem(ROAD_GAME_KEY));
      return (savedCandidates ?? []).filter(({ id }) => saved.includes(id)).map(({ id, name, lat, lng }) => ({ id, name, lat, lng, detail: "Rest area" }));
    } catch { return []; }
  });
  const input = useRef<HTMLInputElement>(null);
  const title = t(lang, field === "from" ? "searchFromTitle" : "searchToTitle");

  useEffect(() => {
    input.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    const text = query.trim();
    if (text.length < 2) { setFound(null); setLoading(false); return; }
    setLoading(true);
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch("/api/places?q=" + encodeURIComponent(text), { signal: controller.signal });
        if (!response.ok) throw new Error("search failed");
        const body: { places: Place[]; source: string } = await response.json();
        setFound({ places: body.places, approx: /approximate/i.test(body.source) });
      } catch {
        if (!controller.signal.aborted) setFound({ places: searchFallback(text), approx: true });
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 300);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [query]);

  const useMyLocation = () => {
    setLocating(true);
    setLocationFailed(false);
    navigator.geolocation?.getCurrentPosition(
      ({ coords }) => {
        setLocating(false);
        if (!inMalaysia(coords.latitude, coords.longitude)) { setLocationFailed(true); return; }
        onPick({ id: "my-location", name: t(lang, "myLocation"), detail: "", lat: Math.round(coords.latitude * 1e4) / 1e4, lng: Math.round(coords.longitude * 1e4) / 1e4 });
      },
      () => { setLocating(false); setLocationFailed(true); },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    ) ?? (setLocating(false), setLocationFailed(true));
  };

  const item = (place: Place, testId: string) => (
    <li key={testId + place.id}>
      <button type="button" className="place-item" data-testid={testId} onClick={() => onPick(place)}>
        <span className="place-pin" aria-hidden="true" />
        <span className="place-text">
          <strong>{place.name}</strong>
          <span className="place-detail">{place.detail}{place.approximate ? (place.detail ? " · " : "") + t(lang, "searchApprox") : ""}</span>
        </span>
      </button>
    </li>
  );

  return <div className="place-search" role="dialog" aria-modal="true" aria-label={title}>
    <header className="place-head">
      <button type="button" className="btn place-close" data-testid="place-close" aria-label={t(lang, "closeCard")} onClick={onClose}>←</button>
      <label className="place-field">
        <span className="sr-only">{title}</span>
        <input ref={input} className="input" data-testid="place-input" type="search" inputMode="search" autoComplete="off"
          placeholder={title} aria-describedby="place-hint" value={query} onChange={(event) => setQuery(event.target.value)} />
      </label>
    </header>
    <p id="place-hint" className="sr-only">{t(lang, "searchPlaceholder")}</p>
    <div className="place-body">
      {found ? <>
        {loading && <p className="small" role="status">{t(lang, "searchingNow")}</p>}
        {found.places.length ? <ul className="place-list">{found.places.map((place) => item(place, "place-result"))}</ul>
          : !loading && <p role="status">{t(lang, "searchNoResults")}</p>}
        {found.approx && found.places.length > 0 && <p className="small">{t(lang, "searchFallbackNote")}</p>}
      </> : <>
        {loading && <p className="small" role="status">{t(lang, "searchingNow")}</p>}
        {field === "from" && <button type="button" className="place-item place-here" data-testid="place-mylocation" disabled={locating} onClick={useMyLocation}>
          <span className="place-pin place-pin-here" aria-hidden="true" />
          <span className="place-text"><strong>{t(lang, locating ? "locating" : "myLocation")}</strong></span>
        </button>}
        {locationFailed && <p className="small" role="alert">{t(lang, "locationFailed")}</p>}
        {saved.length > 0 && <><h3 className="place-heading">Saved places</h3><ul className="place-list">{saved.map((place) => item(place, "place-saved"))}</ul></>}
        {recents.length > 0 && <>
          <h3 className="place-heading">{t(lang, "recentTitle")}</h3>
          <ul className="place-list">{recents.map((place) => item(place, "place-recent"))}</ul>
        </>}
        <h3 className="place-heading">{t(lang, "popularTitle")}</h3>
        <ul className="place-list">{POPULAR.map((place) => item(place, "place-popular-" + place.id))}</ul>
      </>}
    </div>
  </div>;
}
