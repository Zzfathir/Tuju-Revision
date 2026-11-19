"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Map as MapInstance, Marker as MapMarker, StyleSpecification } from "maplibre-gl";
import { pointAt, type RouteLine } from "@/lib/route";
import type { Stop } from "@/lib/schemas";
import { t, type Lang } from "@/lib/i18n";

const libertyUrl = "https://tiles.openfreemap.org/styles/liberty";
const defaultTileUrl = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
type Point = [number, number];
export type Replay = { point: Point; ahead: Point };

function heading(from: Point, to: Point) {
  const north = to[1] - from[1];
  const east = (to[0] - from[0]) * Math.cos(from[1] * Math.PI / 180);
  return Math.atan2(east, north) * 180 / Math.PI;
}

function rasterStyle(tiles: string): StyleSpecification {
  return {
    version: 8,
    sources: { street: { type: "raster", tiles: [tiles], tileSize: 256 } },
    layers: [{ id: "street", type: "raster", source: "street", paint: { "raster-saturation": -0.35 } }],
  };
}

async function streetStyle(): Promise<{ style: StyleSpecification; vector: boolean }> {
  const raster = process.env.NEXT_PUBLIC_TILE_URL;
  if (raster) return { style: rasterStyle(raster), vector: false };
  try {
    const response = await fetch(libertyUrl, { signal: AbortSignal.timeout(3500) });
    if (!response.ok) throw new Error("Street style unavailable");
    const style: StyleSpecification = await response.json();
    style.layers = style.layers.filter(({ id }) => !id.startsWith("poi_"));
    return { style, vector: true };
  } catch {
    return { style: rasterStyle(defaultTileUrl), vector: false };
  }
}

export function RouteMap({ line, stops, position, replay, replayFinished, lang, places, online, preview, selectedStopId, onSelectStop }: {
  line: RouteLine; stops: Stop[]; position: Point | null; replay: Replay | null; lang: Lang; replayFinished: boolean;
  places: [string, string]; online: boolean; preview?: string;
  selectedStopId: string | null; onSelectStop: (id: string | null) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const liveMarker = useRef<MapMarker | null>(null);
  const replayMarker = useRef<MapMarker | null>(null);
  const didReplay = useRef(false);
  const pins = useRef(new Map<string, HTMLElement>());
  const onSelect = useRef(onSelectStop);
  onSelect.current = onSelectStop;
  const [map, setMap] = useState<MapInstance | null>(null);
  const [failed, setFailed] = useState(false);
  const [requested, setRequested] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [vector, setVector] = useState(false);
  const [angled, setAngled] = useState(true);
  const [overview, setOverview] = useState(false);

  const geometry = useMemo(() => {
    const coordinates = line.geometry.coordinates as Point[];
    const start = coordinates[0];
    const end = coordinates.at(-1)!;
    const center = pointAt(line, 0.48);
    const bearing = heading(start, pointAt(line, 1.3));
    const minX = Math.min(...coordinates.map(([x]) => x));
    const maxX = Math.max(...coordinates.map(([x]) => x));
    const minY = Math.min(...coordinates.map(([, y]) => y));
    const maxY = Math.max(...coordinates.map(([, y]) => y));
    function project([x, y]: Point): Point {
      const distance = (maxY - y) / (maxY - minY || 1);
      const spread = angled ? 112 + distance * 73 : 140;
      return [195 + ((x - minX) / (maxX - minX || 1) - 0.5) * spread, 59 + distance * 218];
    }
    return {
      start, end, center, bearing, project,
      outline: coordinates.filter((_, index) => index % 5 === 0 || index === coordinates.length - 1).map(project).join(" "),
    };
  }, [angled, line]);

  const isReplaying = replay !== null;
  useEffect(() => {
    if (isReplaying && online && !failed) setRequested(true);
  }, [failed, isReplaying, online]);
useEffect(() => {
    if (online || map) return;
    setFailed(false);
    setRequested(false);
  }, [map, online]);

  // Load the live map on its own so the first view is never a dead picture. Slow or Save-Data connections keep the tap-to-load preview.
  useEffect(() => {
    if (!online || failed || requested) return;
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    if (connection?.saveData || /(^|-)[23]g$/.test(connection?.effectiveType ?? "")) return;
    const timer = window.setTimeout(() => setRequested(true), 800);
    return () => window.clearTimeout(timer);
  }, [failed, online, requested]);

  useEffect(() => {
    if (!requested) return;
    let active = true;
    let instance: MapInstance | undefined;
    let loadTimeout: number | undefined;
    void Promise.all([import("maplibre-gl"), streetStyle()]).then(([libre, { style, vector }]) => {
      if (!active || !container.current) return;
      libre.setWorkerUrl(new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).toString());
      libre.setWorkerCount(1);
      // Beside the page (wide screen + mouse) the wheel can zoom; on phones two fingers move the map so the page still scrolls.
      const wide = window.matchMedia("(min-width: 900px) and (pointer: fine)").matches;
      const css = getComputedStyle(container.current);
      const token = (name: string) => css.getPropertyValue(name).trim();
      instance = new libre.Map({
        container: container.current, style,
        center: line.geometry.coordinates[0] as Point, zoom: 14.5,
        attributionControl: false, scrollZoom: wide, cooperativeGestures: !wide, maxPitch: 72,
      });
      const current = instance;
      const basemapSource = vector ? "openmaptiles" : "street";
      let tileReady = false;
      let routeReady = false;
      function showMap() {
        if (!active || !tileReady || !routeReady) return;
        window.clearTimeout(loadTimeout);
        setVector(vector);
        setMap(current);
      }
      const onTile = (event: { sourceId: string; tile: unknown }) => {
        if (event.sourceId !== basemapSource || !event.tile) return;
        tileReady = true;
        current.off("sourcedata", onTile);
        showMap();
      };
      current.on("sourcedata", onTile);
      loadTimeout = window.setTimeout(() => {
        if (!active) return;
        current.remove();
        instance = undefined;
        setFailed(true);
      }, 9000);
      current.once("load", () => {
        if (!active) return;
        current.addSource("jalan-pulang-corridor", { type: "geojson", data: line });
        const insertBefore = current.getStyle().layers.find((layer) => layer.type === "symbol")?.id;
        for (const [id, color, width] of [
          ["jalan-pulang-halo", token("--map-route-halo"), 13],
          ["jalan-pulang-route", token("--color-route"), 8],
          ["jalan-pulang-route-shine", token("--map-route-shine"), 2],
        ] as const) {
          current.addLayer({
            id, source: "jalan-pulang-corridor", type: "line",
            layout: { "line-cap": "round", "line-join": "round" },
            paint: { "line-color": color, "line-width": ["interpolate", ["linear"], ["zoom"], 7, width * 0.65, 14, width] },
          }, insertBefore);
        }
        for (const stop of stops) {
          const pin = document.createElement("button");
          pin.type = "button";
          pin.className = "map-pin";
          pin.title = stop.name;
          pin.setAttribute("aria-label", stop.name);
          pin.dataset.testid = "map-stop-" + stop.id;
          pin.addEventListener("click", (event) => { event.stopPropagation(); onSelect.current(stop.id); });
          pins.current.set(stop.id, pin);
          new libre.Marker({ element: pin }).setLngLat([stop.lng, stop.lat]).addTo(current);
        }
        for (const [index, point] of [line.geometry.coordinates[0], line.geometry.coordinates.at(-1)!].entries()) {
          const pin = document.createElement("span");
          pin.className = "map-pin map-endpoint";
          pin.dataset.destination = String(index === 1);
          new libre.Marker({ element: pin }).setLngLat(point as Point).addTo(current);
        }
        const live = document.createElement("span");
        live.className = "map-position";
        liveMarker.current = new libre.Marker({ element: live });
        const playback = document.createElement("span");
        playback.className = "map-vehicle";
        replayMarker.current = new libre.Marker({ element: playback, rotationAlignment: "viewport" });
        routeReady = true;
        showMap();
      });
    }).catch(() => {
      if (active) setFailed(true);
    });
    return () => {
      active = false;
      window.clearTimeout(loadTimeout);
      liveMarker.current?.remove();
      replayMarker.current?.remove();
      liveMarker.current = null;
      replayMarker.current = null;
      pins.current.clear();
      instance?.remove();
    };
  }, [attempt, line, requested, stops]);

  useEffect(() => {
    if (!map || isReplaying) return;
    if (overview) {
      const points = line.geometry.coordinates;
      const west = Math.min(...points.map(([x]) => x));
      const east = Math.max(...points.map(([x]) => x));
      const south = Math.min(...points.map(([, y]) => y));
      const north = Math.max(...points.map(([, y]) => y));
      map.fitBounds([[west, south], [east, north]], { padding: { top: 76, bottom: 52, left: 38, right: 70 }, bearing: 0, pitch: 0, duration: 0 });
      if (angled) map.jumpTo({ pitch: 28, zoom: map.getZoom() - 0.36 });
    } else {
      map.jumpTo({ center: angled ? geometry.center : geometry.start, bearing: angled ? geometry.bearing : 0, pitch: angled ? 59 : 0, zoom: 14.6 });
    }
  }, [angled, geometry, isReplaying, line, map, overview]);

  useEffect(() => {
    if (map?.getLayer("building-3d")) map.setLayoutProperty("building-3d", "visibility", angled ? "visible" : "none");
  }, [angled, map]);

  useEffect(() => {
    if (!map) return;
    if (position) liveMarker.current?.setLngLat(position).addTo(map);
    else liveMarker.current?.remove();
  }, [map, position]);

  useEffect(() => {
    if (!map || !replay) {
      replayMarker.current?.remove();
      didReplay.current = false;
      return;
    }
    const direction = heading(replay.point, replay.ahead);
    replayMarker.current?.setLngLat(replay.point).setRotation(angled ? 0 : direction).addTo(map);
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    map.easeTo({
      center: replay.point, zoom: 14.1, bearing: angled ? direction : 0, pitch: angled ? 63 : 0,
      offset: [0, 38], duration: didReplay.current && !reduceMotion ? 380 : 0,
    });
    didReplay.current = true;
  }, [angled, map, replay]);

  useEffect(() => {
    if (selectedStopId && online && !failed) setRequested(true);
  }, [failed, online, selectedStopId]);

  useEffect(() => {
    for (const [id, pin] of pins.current) pin.dataset.selected = String(id === selectedStopId);
    const stop = stops.find((item) => item.id === selectedStopId);
    if (!map || !stop || isReplaying) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    map.easeTo({ center: [stop.lng, stop.lat], zoom: Math.max(map.getZoom(), 13), duration: reduceMotion ? 0 : 600 });
  }, [isReplaying, map, selectedStopId, stops]);

  // Expose the zoom level on the map element (used by the browser checks).
  useEffect(() => {
    const wrap = container.current?.parentElement;
    if (!map || !wrap) return;
    const sync = () => { wrap.dataset.zoom = map.getZoom().toFixed(2); };
    sync();
    map.on("zoom", sync);
    return () => { map.off("zoom", sync); };
  }, [map]);

  const outlinePosition = replay?.point ?? position;
  const showPreview = preview && online && !map && !failed && angled && !overview && !outlinePosition;
  return <section className="map-wrap" aria-label={t(lang, "map")} data-testid="route-map"
    data-angle={angled ? "3d" : "2d"} data-frame={replay ? "replay" : overview ? "overview" : "drive"}>
    <div className="map-outline" aria-hidden="true">
      <svg viewBox="0 0 390 340" preserveAspectRatio="xMidYMid meet">
        <polyline className="outline-halo" points={geometry.outline} />
        <polyline className="outline-route" points={geometry.outline} />
        {stops.map((stop) => {
          const [x, y] = geometry.project([stop.lng, stop.lat]);
          return <circle className="outline-stop" key={stop.id} cx={x} cy={y} r="3" />;
        })}
        {[geometry.end, geometry.start].map((point, index) => {
          const [x, y] = geometry.project(point);
          return <g key={index}>
            <circle className="outline-endpoint" cx={x} cy={y} r="7" />
            <text x={x + (index ? -13 : 13)} y={y + 5} textAnchor={index ? "end" : "start"}>{places[1 - index]}</text>
          </g>;
        })}
        {outlinePosition && <circle className="outline-position" cx={geometry.project(outlinePosition)[0]} cy={geometry.project(outlinePosition)[1]} r="8" />}
      </svg>
    </div>
    {showPreview && <img className="map-preview" src={preview} alt="" fetchPriority="high" width={760} height={848} onClick={() => setRequested(true)} />}
    <div ref={container} className="map-canvas" data-visible={Boolean(map) && online && !failed} />
    <div className="map-tools" aria-label={t(lang, "mapView")} role="group">
      <div className="map-angle" role="group" aria-label={t(lang, "perspective")}>
        {[false, true].map((perspective) => (
          <button key={String(perspective)} type="button" data-testid={perspective ? "map-3d" : "map-2d"}
            aria-pressed={perspective === angled}
            onClick={() => { setAngled(perspective); if (online) setRequested(true); }}>
            {perspective ? "3D" : "2D"}
          </button>
        ))}
      </div>
      <div className="map-angle map-zoom" role="group" aria-label={t(lang, "mapView")}>
        <button type="button" data-testid="map-zoom-in" aria-label={t(lang, "mapZoomIn")} disabled={!map} onClick={() => map?.zoomIn({ duration: 250 })}>+</button>
        <button type="button" data-testid="map-zoom-out" aria-label={t(lang, "mapZoomOut")} disabled={!map} onClick={() => map?.zoomOut({ duration: 250 })}>−</button>
      </div>
      <button type="button" className="map-control" data-testid="map-frame" disabled={!online || failed || Boolean(replay)}
        onClick={() => { setOverview(!overview); if (online) setRequested(true); }}>
        {t(lang, overview ? "driveView" : "fullRoute")}
      </button>
      {failed && online && <button type="button" className="map-control"
        onClick={() => { setFailed(false); setAttempt((value) => value + 1); }}>{t(lang, "retry")}</button>}
    </div>
    {!map && online && !failed ? <button type="button" className="map-legend map-launch" data-testid="open-street-map"
      disabled={requested} onClick={() => setRequested(true)}>
      <span className="map-key" aria-hidden="true" />
      {t(lang, requested ? "loading" : showPreview ? "exploreMap" : "streetMap")}
    </button> : <div className="map-legend">
      <span className="map-key" aria-hidden="true" />
      <span>{t(lang, replay ? replayFinished ? "arrived" : "simulation" : !online || failed || !map ? "routeOutline" : overview ? "routeOverview" : "driveView")}</span>
    </div>}
    <div className="map-credit">
      {((vector && online) || showPreview) && <><a href="https://openfreemap.org/">OpenFreeMap</a><span> · </span><a href="https://openmaptiles.org/">© OpenMapTiles</a><span> · </span></>}
      <a href="https://www.openstreetmap.org/copyright">© OpenStreetMap</a>
    </div>
  </section>;
}
