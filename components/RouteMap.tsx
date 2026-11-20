"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { GeoJSONSource, Map as MapInstance, Marker as MapMarker, StyleSpecification } from "maplibre-gl";
import { bearingBetween, driveCamera, type DriveFrame, type DrivePoint } from "@/lib/drive-camera";
import { pointAt, routeLengthKm, sliceAhead, type RouteLine } from "@/lib/route";
import { zoomForSpeed } from "@/lib/cruise/zoom";
import type { Stop } from "@/lib/schemas";
import { t, type Lang } from "@/lib/i18n";

const libertyUrl = "https://tiles.openfreemap.org/styles/liberty";
const defaultTileUrl = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
type Point = DrivePoint;

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

export function RouteMap({ line, stops, driveFrame, simulated, lang, places, online, preview, selectedStopId, onSelectStop, focus, padding, driving = false, headingUp = true, browsing, startNorthUp }: {
  line: RouteLine; stops: Stop[]; driveFrame: DriveFrame | null; simulated: boolean; lang: Lang;
  places: [string, string]; online: boolean; preview?: string;
  selectedStopId: string | null; onSelectStop?: (id: string | null) => void; driving?: boolean;
  /** While driving: turn the map with the car (true) or keep north at the top (false). */
  headingUp?: boolean;
  browsing: boolean; startNorthUp: boolean;
  /** Where to fly when a stop is selected; also covers break points, which have no pin. */
  focus?: { id: string; lat: number; lng: number } | null;
  /** Pixels of the map hidden under floating UI (the sheet, the from/to card). The camera frames the visible part. */
  padding?: { top: number; right: number; bottom: number; left: number };
}) {
  const container = useRef<HTMLDivElement>(null);
  const vehicleMarker = useRef<MapMarker | null>(null);
  const didFollow = useRef(false);
  const routeColors = useRef({ ahead: "", passed: "", shine: "" });
  const pins = useRef(new Map<string, HTMLElement>());
  const onSelect = useRef(onSelectStop);
  onSelect.current = onSelectStop;
  const [map, setMap] = useState<MapInstance | null>(null);
  const [failed, setFailed] = useState(false);
  const [requested, setRequested] = useState(false);
  const [manualLoad, setManualLoad] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [vector, setVector] = useState(false);
  const [planAngled, setPlanAngled] = useState(!startNorthUp);
  const [driveAngled, setDriveAngled] = useState(true);
  const [following, setFollowing] = useState(true);
  const [overview, setOverview] = useState(false);
  const angled = driving ? driveAngled : planAngled;

  const geometry = useMemo(() => {
    const coordinates = line.geometry.coordinates as Point[];
    const start = coordinates[0];
    const end = coordinates.at(-1)!;
    const center = pointAt(line, 0.48);
    const bearing = bearingBetween(start, pointAt(line, 1.3));
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

  useEffect(() => {
    if (driving && online && !failed) setRequested(true);
    if (!driving) {
      setFollowing(true);
      setDriveAngled(true);
    }
  }, [driving, failed, online]);

  useEffect(() => {
    if (online || map) return;
    setFailed(false);
    setRequested(false);
  }, [map, online]);

  // Load the live map on its own so the first view is never a dead picture. Slow or Save-Data connections keep the tap-to-load preview.
  useEffect(() => {
    if (!online || failed || requested) return;
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    if (connection?.saveData || (!browsing && /(^|-)[23]g$/.test(connection?.effectiveType ?? ""))) {
      setManualLoad(true);
      return;
    }
    if (browsing) { setRequested(true); return; }
    const timer = window.setTimeout(() => setRequested(true), 800);
    return () => window.clearTimeout(timer);
  }, [browsing, failed, online, requested]);

  useEffect(() => {
    if (!requested) return;
    let active = true;
    let instance: MapInstance | undefined;
    let loadTimeout: number | undefined;
    void Promise.all([import("maplibre-gl"), streetStyle()]).then(([libre, { style, vector }]) => {
      if (!active || !container.current) return;
      libre.setWorkerUrl(new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).toString());
      libre.setWorkerCount(1);
      const hasMouse = window.matchMedia("(pointer: fine)").matches;
      const css = getComputedStyle(container.current);
      const token = (name: string) => css.getPropertyValue(name).trim();
      routeColors.current = { ahead: token("--color-route"), passed: token("--map-route-passed"), shine: token("--map-route-shine") };
      instance = new libre.Map({
        container: container.current, style,
        center: line.geometry.coordinates[0] as Point, zoom: startNorthUp ? 12.8 : 14.5,
        attributionControl: false, scrollZoom: hasMouse, cooperativeGestures: !hasMouse, maxPitch: 72,
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
        current.addSource("jalan-pulang-corridor", { type: "geojson", data: line, lineMetrics: true });
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
        // A lit ribbon with chevrons on the road ahead of the car, like Amap's cruise view. Hidden until a drive starts.
        current.addSource("jalan-pulang-ahead", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
        const chevron = document.createElement("canvas");
        chevron.width = chevron.height = 32;
        const ink = chevron.getContext("2d");
        if (ink) {
          ink.strokeStyle = "#ffffff"; ink.lineWidth = 5; ink.lineCap = "round"; ink.lineJoin = "round";
          ink.beginPath(); ink.moveTo(11, 7); ink.lineTo(21, 16); ink.lineTo(11, 25); ink.stroke();
          current.addImage("route-chevron", ink.getImageData(0, 0, 32, 32), { pixelRatio: 2 });
        }
        current.addLayer({
          id: "jalan-pulang-ribbon", source: "jalan-pulang-ahead", type: "line",
          layout: { "line-cap": "round", "line-join": "round", visibility: "none" },
          paint: { "line-color": token("--map-route-shine"), "line-width": ["interpolate", ["linear"], ["zoom"], 12, 12, 17, 44], "line-opacity": 0.5, "line-blur": 3 },
        }, "jalan-pulang-halo");
        current.addLayer({
          id: "jalan-pulang-chevrons", source: "jalan-pulang-ahead", type: "symbol",
          layout: {
            "symbol-placement": "line", "symbol-spacing": 48, "icon-image": "route-chevron", "icon-size": 0.9,
            "icon-allow-overlap": true, "icon-ignore-placement": true, visibility: "none",
          },
          paint: { "icon-opacity": 0.9 },
        });
        for (const stop of stops) {
          const pin = document.createElement("button");
          pin.type = "button";
          pin.className = "map-pin";
          pin.title = stop.name;
          pin.setAttribute("aria-label", stop.name);
          pin.dataset.testid = "map-stop-" + stop.id;
          pin.addEventListener("click", (event) => { event.stopPropagation(); onSelect.current?.(stop.id); });
          pins.current.set(stop.id, pin);
          new libre.Marker({ element: pin }).setLngLat([stop.lng, stop.lat]).addTo(current);
        }
        for (const [index, point] of [line.geometry.coordinates[0], line.geometry.coordinates.at(-1)!].entries()) {
          const pin = document.createElement("span");
          pin.className = "map-pin map-endpoint";
          pin.dataset.destination = String(index === 1);
          new libre.Marker({ element: pin }).setLngLat(point as Point).addTo(current);
        }
        const vehicle = document.createElement("span");
        vehicle.className = "map-vehicle";
        vehicle.dataset.testid = "drive-car";
        vehicle.setAttribute("aria-hidden", "true");
        vehicleMarker.current = new libre.Marker({ element: vehicle, rotationAlignment: "map", pitchAlignment: "viewport" });
        routeReady = true;
        showMap();
      });
    }).catch(() => {
      if (active) setFailed(true);
    });
    return () => {
      active = false;
      window.clearTimeout(loadTimeout);
      vehicleMarker.current?.remove();
      vehicleMarker.current = null;
      pins.current.clear();
      instance?.remove();
    };
  }, [attempt, line, requested, startNorthUp, stops]);

  // Keep the visible middle of the map clear of the sheet and the card without resetting the camera.
  useEffect(() => {
    if (map && padding) map.setPadding(padding);
  }, [map, padding]);

  useEffect(() => {
    if (!map || driving) return;
    if (overview) {
      const points = line.geometry.coordinates;
      const west = Math.min(...points.map(([x]) => x));
      const east = Math.max(...points.map(([x]) => x));
      const south = Math.min(...points.map(([, y]) => y));
      const north = Math.max(...points.map(([, y]) => y));
      map.fitBounds([[west, south], [east, north]], { padding: { top: 24, bottom: 24, left: 24, right: 72 }, bearing: 0, pitch: 0, duration: 0 });
      if (angled) map.jumpTo({ pitch: 28, zoom: map.getZoom() - 0.36 });
    } else {
      map.jumpTo({ center: angled ? geometry.center : geometry.start, bearing: angled ? geometry.bearing : 0,
        pitch: angled ? 59 : 0, zoom: !angled && startNorthUp ? 12.8 : 14.6 });
    }
  }, [angled, driving, geometry, line, map, overview, startNorthUp]);

  useEffect(() => {
    if (map?.getLayer("building-3d")) map.setLayoutProperty("building-3d", "visibility", angled ? "visible" : "none");
  }, [angled, map]);

  useEffect(() => {
    if (!map || !driving) return;
    const pause = () => { setFollowing(false); map.stop(); };
    map.on("dragstart", pause);
    return () => { map.off("dragstart", pause); };
  }, [driving, map]);

  useEffect(() => {
    if (!map || !driving || !driveFrame) {
      vehicleMarker.current?.remove();
      didFollow.current = false;
      return;
    }
    const marker = vehicleMarker.current;
    if (!marker) return;
    const course = driveFrame.course;
    marker.setLngLat(driveFrame.point).setRotation(course ?? 0);
    if (!marker.getElement().isConnected) marker.addTo(map);
    if (!following) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const camera = driveCamera(angled, course, map.getContainer().clientHeight, headingUp);
    map.easeTo({
      ...camera, center: driveFrame.point,
      zoom: driveFrame.speedKmh !== undefined ? zoomForSpeed(driveFrame.speedKmh) : didFollow.current ? map.getZoom() : 14.6,
      duration: didFollow.current && !reduceMotion ? 240 : 0,
    });
    didFollow.current = true;
  }, [angled, driveFrame, driving, following, headingUp, map]);

  const fraction = driveFrame?.fraction ?? null;
  const totalKm = useMemo(() => routeLengthKm(line), [line]);
  const lastAhead = useRef(-1);
  useEffect(() => {
    if (!map) return;
    const lit = driving && fraction !== null;
    for (const id of ["jalan-pulang-ribbon", "jalan-pulang-chevrons"]) {
      if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", lit ? "visible" : "none");
    }
    const source = map.getSource("jalan-pulang-ahead") as GeoJSONSource | undefined;
    if (!source) return;
    if (!lit) { lastAhead.current = -1; source.setData({ type: "FeatureCollection", features: [] }); return; }
    const km = fraction * totalKm;
    if (Math.abs(km - lastAhead.current) < 0.15) return; // redraw about every 150 m
    lastAhead.current = km;
    source.setData(sliceAhead(line, km, 6));
  }, [driving, fraction, line, map, totalKm]);
  useEffect(() => {
    if (!map) return;
    const { ahead, passed, shine } = routeColors.current;
    const split = fraction !== null && fraction > 0 ? fraction : null;
    map.setPaintProperty("jalan-pulang-route", "line-gradient", split === null
      ? undefined : ["step", ["line-progress"], passed, split, ahead]);
    map.setPaintProperty("jalan-pulang-route-shine", "line-gradient", split === null
      ? undefined : ["step", ["line-progress"], "rgba(0,0,0,0)", split, shine]);
  }, [fraction, map]);

  useEffect(() => {
    if (selectedStopId && online && !failed) setRequested(true);
  }, [failed, online, selectedStopId]);

  useEffect(() => {
    for (const [id, pin] of pins.current) {
      pin.dataset.selected = String(id === selectedStopId);
      pin.tabIndex = driving ? -1 : 0;
    }
    const stop = focus && focus.id === selectedStopId ? focus : stops.find((item) => item.id === selectedStopId);
    if (!map || !stop || driving) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    map.easeTo({ center: [stop.lng, stop.lat], zoom: Math.max(map.getZoom(), 13), duration: reduceMotion ? 0 : 600 });
  }, [driving, focus, map, selectedStopId, stops]);

  // Expose the zoom level on the map element (used by the browser checks).
  useEffect(() => {
    const wrap = container.current?.parentElement;
    if (!map || !wrap) return;
    const sync = () => {
      wrap.dataset.zoom = map.getZoom().toFixed(2);
      wrap.dataset.bearing = map.getBearing().toFixed(1);
      wrap.dataset.pitch = map.getPitch().toFixed(1);
    };
    sync();
    map.on("moveend", sync);
    return () => { map.off("moveend", sync); };
  }, [map]);

  const outlinePosition = driveFrame ? geometry.project(driveFrame.point) : null;
  const openingPreview = browsing && !angled && preview;
  const previewImage = openingPreview ? "/kl-map-preview.jpg" : preview;
  const showPreview = previewImage && online && !map && (openingPreview || (!failed && angled)) && !overview && !outlinePosition;
  const setPerspective = (perspective: boolean) => {
    if (driving) { setDriveAngled(perspective); setFollowing(true); }
    else setPlanAngled(perspective);
    if (online) setRequested(true);
  };
  return <section className="map-wrap" aria-label={t(lang, "map")} data-testid="route-map"
    data-angle={angled ? "3d" : "2d"} data-frame={simulated ? "replay" : !driving && overview ? "overview" : "drive"}
    data-follow={driving ? following : undefined}>
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
        {outlinePosition && <image href="/drive-car.svg" x={outlinePosition[0] - 16} y={outlinePosition[1] - 20}
          width="32" height="42" transform={`rotate(${driveFrame?.course ?? 0} ${outlinePosition[0]} ${outlinePosition[1]})`} />}
      </svg>
    </div>
    {showPreview && <img className="map-preview" src={previewImage} alt="" fetchPriority="high"
      width={openingPreview ? 585 : 760} height={openingPreview ? 1266 : 848} onClick={() => setRequested(true)} />}
    <div ref={container} className="map-canvas" data-visible={Boolean(map) && online && !failed} />
    <div className="map-tools" aria-label={t(lang, "mapView")} role="group">
      {browsing ? <button type="button" className="map-control map-perspective-toggle"
        data-testid={angled ? "map-2d" : "map-3d"} onClick={() => setPerspective(!angled)}>
        {angled ? "2D" : "3D"}
      </button> : <div className="map-angle" role="group" aria-label={t(lang, "perspective")}>
        {[false, true].map((perspective) => (
          <button key={String(perspective)} type="button" data-testid={perspective ? "map-3d" : "map-2d"}
            aria-pressed={perspective === angled}
            onClick={() => setPerspective(perspective)}>
            {perspective ? "3D" : "2D"}
          </button>
        ))}
      </div>}
      {!browsing && <div className="map-angle map-zoom" role="group" aria-label={t(lang, "mapView")}>
        <button type="button" data-testid="map-zoom-in" aria-label={t(lang, "mapZoomIn")} disabled={!map} onClick={() => map?.zoomIn({ duration: 250 })}>+</button>
        <button type="button" data-testid="map-zoom-out" aria-label={t(lang, "mapZoomOut")} disabled={!map} onClick={() => map?.zoomOut({ duration: 250 })}>−</button>
      </div>}
      {driving && !following && map && online && <button type="button" className="map-control" data-testid="map-recenter"
        onClick={() => setFollowing(true)}>{t(lang, "mapRecenter")}</button>}
      {!driving && <button type="button" className="map-control" data-testid="map-frame" disabled={!online || failed}
        onClick={() => { setOverview(!overview); if (online) setRequested(true); }}>
        {t(lang, overview ? "driveView" : "fullRoute")}
      </button>}
      {failed && online && <button type="button" className="map-control"
        onClick={() => { setFailed(false); setAttempt((value) => value + 1); }}>{t(lang, "retry")}</button>}
    </div>
    {!map && online && !failed ? (browsing && !manualLoad ? <p className="map-legend" role="status">{t(lang, "loading")}</p>
    : <button type="button" className="map-legend map-launch" data-testid="open-street-map"
      disabled={requested} onClick={() => setRequested(true)}>
      <span className="map-key" aria-hidden="true" />
      {t(lang, requested ? "loading" : showPreview ? "exploreMap" : "streetMap")}
    </button>) : (!browsing && !driving || !online || failed || !map) && <div className="map-legend">
      <span className="map-key" aria-hidden="true" />
      <span>{t(lang, !online || failed || !map ? "routeOutline" : overview ? "routeOverview" : "driveView")}</span>
    </div>}
    <div className="map-credit">
      {((vector && online) || showPreview) && <><a href="https://openfreemap.org/">OpenFreeMap</a><span> · </span><a href="https://openmaptiles.org/">© OpenMapTiles</a><span> · </span></>}
      <a href="https://www.openstreetmap.org/copyright">© OpenStreetMap</a>
    </div>
  </section>;
}
