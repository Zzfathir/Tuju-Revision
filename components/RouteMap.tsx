"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as MapInstance, Marker as MapMarker } from "maplibre-gl";
import type { RouteLine } from "@/lib/route";
import type { Stop } from "@/lib/schemas";
import { t, type Lang } from "@/lib/i18n";

export function RouteMap({ line, stops, position, lang }: {
  line: RouteLine; stops: Stop[]; position: [number, number] | null; lang: Lang;
}) {
  const container = useRef<HTMLDivElement>(null);
  const marker = useRef<MapMarker | null>(null);
  const [map, setMap] = useState<MapInstance | null>(null);
  const [failed, setFailed] = useState(false);
  const [interactive, setInteractive] = useState(false);
  useEffect(() => {
    if (!interactive) return;
    let active = true;
    let instance: MapInstance | undefined;
    void import("maplibre-gl").then(({ Map, LngLatBounds, Marker, NavigationControl, setWorkerUrl }) => {
      if (!active || !container.current) return;
      setWorkerUrl(new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).toString());
      const css = getComputedStyle(container.current);
      const mapColor = css.getPropertyValue("--color-route").trim();
      instance = new Map({
        container: container.current,
        attributionControl: false,
        scrollZoom: false,
        cooperativeGestures: true,
        style: {
          version: 8,
          sources: {
            street: {
              type: "raster",
              tiles: [process.env.NEXT_PUBLIC_TILE_URL || "https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
              tileSize: 256,
            },
            corridor: { type: "geojson", data: line },
          },
          layers: [
            { id: "street", type: "raster", source: "street", paint: { "raster-saturation": -1 } },
            { id: "corridor", type: "line", source: "corridor", paint: {
              "line-color": mapColor, "line-width": Number(css.getPropertyValue("--map-line-width")),
            } },
          ],
        },
      });
      const bounds = new LngLatBounds();
      for (const [lng, lat] of line.geometry.coordinates) bounds.extend([lng, lat]);
      instance.fitBounds(bounds, { padding: Number.parseInt(css.getPropertyValue("--space-6")), duration: 0 });
      instance.addControl(new NavigationControl({ showCompass: false }));
      for (const stop of stops) {
        const element = document.createElement("span");
        element.className = "marker";
        element.title = stop.name;
        new Marker({ element }).setLngLat([stop.lng, stop.lat]).addTo(instance);
      }
      const element = document.createElement("span");
      element.className = "marker";
      element.dataset.kind = "me";
      marker.current = new Marker({ element });
      setMap(instance);
    }).catch(() => { if (active) setFailed(true); });
    return () => {
      active = false;
      marker.current?.remove();
      marker.current = null;
      instance?.remove();
    };
  }, [interactive, line, stops]);

  useEffect(() => {
    if (map && position) marker.current?.setLngLat(position).addTo(map);
    else marker.current?.remove();
  }, [map, position]);

  const coordinates = line.geometry.coordinates;
  const minX = Math.min(...coordinates.map(([x]) => x));
  const maxX = Math.max(...coordinates.map(([x]) => x));
  const minY = Math.min(...coordinates.map(([, y]) => y));
  const maxY = Math.max(...coordinates.map(([, y]) => y));
  const project = ([x, y]: number[]) => [(x - minX) / (maxX - minX || 1) * 100 + 10, (maxY - y) / (maxY - minY || 1) * 200 + 10];
  return <section className="map-wrap" aria-label={t(lang, "map")} data-testid="route-map">
    <svg className="map-outline" viewBox="0 0 120 220" aria-hidden="true">
      <polyline points={coordinates.filter((_, index) => index % 5 === 0 || index === coordinates.length - 1).map(project).join(" ")} />
      {position && <circle cx={project(position)[0]} cy={project(position)[1]} r="4" />}
    </svg>
    <div ref={container} className="map-canvas" data-visible={Boolean(map) && !failed} />
    {!map && !failed && <button type="button" className="btn map-open" data-testid="open-street-map"
      disabled={interactive} onClick={() => setInteractive(true)}>{t(lang, interactive ? "loading" : "streetMap")}</button>}
    {failed && <p className="map-note">{t(lang, "mapUnavailable")}</p>}
    <a className="map-credit" href="https://www.openstreetmap.org/copyright">© OpenStreetMap</a>
  </section>;
}
