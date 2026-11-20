/**
 * "Night Ops" / "Mod Misi" map theme: pure helpers, no React or map imports.
 * The vector style is patched at runtime (OpenMapTiles schema, as served by OpenFreeMap). Colours come from tokens,
 * never from this file. Original look inspired by dark map selectors; no third-party game art, names or fonts.
 */
import type { StyleSpecification, LayerSpecification } from "maplibre-gl";
import type { Stop } from "@/lib/schemas";

export type Theme = "default" | "night-ops";
export const NIGHT_KEY = "jalan-pulang-night";

/** User choice: "on" always, "off" never, null = automatic (Night Ops while Cruise is running). */
export type NightPref = "on" | "off" | null;
export function isNight(pref: NightPref, driving: boolean): boolean {
  return pref === "on" || (driving && pref !== "off");
}
export function readNightPref(): NightPref {
  try {
    const value = window.localStorage.getItem(NIGHT_KEY);
    return value === "on" || value === "off" ? value : null;
  } catch { return null; }
}
export function writeNightPref(pref: NightPref): void {
  try {
    if (pref) window.localStorage.setItem(NIGHT_KEY, pref);
    else window.localStorage.removeItem(NIGHT_KEY);
  } catch { /* storage can be blocked; the choice then lasts for this visit only */ }
}

/** Token names read from CSS (see app/night-ops.css). */
export const MAP_TOKEN_NAMES = [
  "--map-land", "--map-water", "--map-coast-glow", "--map-road-minor", "--map-road-major",
  "--map-road-motorway", "--map-label", "--map-building",
] as const;
export type MapTokens = Record<(typeof MAP_TOKEN_NAMES)[number], string>;

export const COAST_BANDS = [
  { width: 2, opacity: 0.55 }, { width: 6, opacity: 0.35 }, { width: 12, opacity: 0.22 },
  { width: 22, opacity: 0.12 }, { width: 36, opacity: 0.06 },
] as const;

function glowLayers(sourceId: string, sourceLayer: string, color: string, bands: number): LayerSpecification[] {
  return COAST_BANDS.slice(0, bands).map(({ width, opacity }, index) => ({
    id: "night-coast-glow-" + index, type: "line", source: sourceId, "source-layer": sourceLayer,
    layout: { "line-join": "round" },
    paint: {
      "line-color": color,
      // quiet when zoomed far out (lakes and rivers would otherwise flare), full around z10-11, calmer up close
      "line-opacity": ["interpolate", ["linear"], ["zoom"], 5, opacity * 0.15, 9, opacity * 0.6, 11, opacity],
      "line-width": ["interpolate", ["linear"], ["zoom"], 5, width * 0.15, 10, width, 16, width * 0.5],
      "line-blur": ["interpolate", ["linear"], ["zoom"], 5, width * 0.15, 10, width, 16, width * 0.5],
    },
  }));
}

function roadColor(id: string, tokens: MapTokens): string {
  if (/motorway|trunk/.test(id)) return tokens["--map-road-motorway"];
  if (/primary|secondary|tertiary/.test(id)) return tokens["--map-road-major"];
  return tokens["--map-road-minor"];
}

/**
 * Returns a restyled copy of `base`. Raster styles are dimmed instead (no vector layers to recolour).
 * `bands` is the number of coast-glow layers: 5 normally, 1 in Lite mode, 0 for none.
 */
export function patchNightOps(base: StyleSpecification, tokens: MapTokens, options: { bands?: number } = {}): StyleSpecification {
  const bands = options.bands ?? COAST_BANDS.length;
  const style: StyleSpecification = structuredClone(base);
  const land = tokens["--map-land"];
  const isVector = style.layers.some((layer) => "source-layer" in layer && layer["source-layer"]);
  if (!isVector) {
    style.layers = style.layers.map((layer) => layer.type === "raster"
      ? { ...layer, paint: { ...layer.paint, "raster-brightness-max": 0.28, "raster-saturation": -1, "raster-contrast": 0.2 } }
      : layer);
    return style;
  }
  const out: LayerSpecification[] = [];
  let glowAdded = false;
  for (const layer of style.layers) {
    const sourceLayer = "source-layer" in layer ? layer["source-layer"] : undefined;
    const id = layer.id;
    if (layer.type === "background") {
      out.push({ ...layer, paint: { "background-color": land } });
    } else if (layer.type === "fill") {
      const water = sourceLayer === "water";
      out.push({ ...layer, paint: { "fill-color": water ? tokens["--map-water"] : land, "fill-opacity": 1 } });
      if (water && !glowAdded && "source" in layer && bands > 0) {
        glowAdded = true;
        out.push(...glowLayers(layer.source, "water", tokens["--map-coast-glow"], bands));
      }
    } else if (layer.type === "fill-extrusion") {
      out.push({ ...layer, minzoom: Math.max(layer.minzoom ?? 0, 14.5), paint: { "fill-extrusion-color": tokens["--map-building"], "fill-extrusion-opacity": 0.6, "fill-extrusion-vertical-gradient": true } });
    } else if (layer.type === "line") {
      if (sourceLayer === "waterway") {
        out.push({ ...layer, paint: { "line-color": tokens["--map-water"] } });
      } else if (sourceLayer === "transportation") {
        // no casings, rail, paths or ferries; the road network is a single thin stroke per class
        const hidden = /casing|rail|path|pedestrian|ferry|aerial|track|steps|ford/.test(id);
        out.push({
          ...layer,
          layout: { ...layer.layout, visibility: hidden ? "none" : layer.layout?.visibility ?? "visible" },
          paint: { "line-color": roadColor(id, tokens), "line-opacity": 1, "line-width": layer.paint?.["line-width"] ?? 1 },
        });
      } else {
        // boundaries, aeroway outlines and the like stay out of the dark look
        out.push({ ...layer, layout: { ...layer.layout, visibility: "none" } });
      }
    } else if (layer.type === "symbol") {
      const place = /place|country|state|city|town|village/.test(id);
      out.push({
        ...layer,
        layout: { ...layer.layout, ...(place ? { "text-transform": "uppercase", "text-letter-spacing": 0.08 } : {}), ...(/housenumber|poi|airport/.test(id) ? { visibility: "none" } : {}) },
        paint: { ...layer.paint, "text-color": tokens["--map-label"], "text-halo-color": land, "text-halo-width": 1.5, "icon-opacity": 0.6 },
      });
    } else out.push(layer);
  }
  style.layers = out;
  // dark fog toward the horizon instead of a pale sky when the map is tilted
  style.sky = { "sky-color": land, "horizon-color": land, "fog-color": land, "sky-horizon-blend": 0.5, "horizon-fog-blend": 0.6, "fog-ground-blend": 0.2 };
  return style;
}

/* ---- diamond pin categories: one config, shown in the legend ---- */
export type PinCategory = "green" | "blue" | "yellow" | "red" | "orange" | "neutral";
export type PinIcon = "surau" | "bolt" | "fuel" | "alert" | "flag" | "start";

export const PIN_LEGEND: { category: Exclude<PinCategory, "neutral">; icon: PinIcon; label: { en: string; bm: string } }[] = [
  { category: "green", icon: "surau", label: { en: "Rest stop with surau", bm: "R&R dengan surau" } },
  { category: "blue", icon: "bolt", label: { en: "EV charging", bm: "Pengecas EV" } },
  { category: "yellow", icon: "fuel", label: { en: "Fuel or toll", bm: "Minyak atau tol" } },
  { category: "red", icon: "alert", label: { en: "Hazard or warning", bm: "Bahaya atau amaran" } },
  { category: "orange", icon: "flag", label: { en: "Destination", bm: "Destinasi" } },
];

/** Stops are coloured by what we have confirmed there; facilities that are unknown never count. */
export function stopPin(stop: Pick<Stop, "facilities" | "verified">): { category: PinCategory; icon: PinIcon; unverified: boolean } {
  const { surau, evCharger, fuel } = stop.facilities;
  const unverified = !stop.verified;
  if (evCharger === true) return { category: "blue", icon: "bolt", unverified };
  if (surau === true) return { category: "green", icon: "surau", unverified };
  if (fuel === true) return { category: "yellow", icon: "fuel", unverified };
  return { category: "green", icon: "surau", unverified: true };
}

const GLYPHS: Record<PinIcon, string> = {
  surau: "M16 6.5a5.5 5.5 0 1 0 3 10 6 6 0 1 1-3-10Z",
  bolt: "M17 4 9 17h6l-1 7 8-13h-6l1-7Z",
  fuel: "M9 22V8a2 2 0 0 1 2-2h5a2 2 0 0 1 2 2v14M7 22h13M18 11h2.5a1.5 1.5 0 0 1 1.5 1.5V19a1.5 1.5 0 0 1-3 0",
  alert: "M15 7v9M15 20v.5",
  flag: "M9 24V6M9 7h12l-3 4 3 4H9",
  start: "M15 15m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0",
};
/** White line icon, drawn on a 30×30 box. Returned as markup for the map's DOM pins. */
export function pinGlyph(icon: PinIcon): string {
  return `<svg viewBox="0 0 30 30" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${GLYPHS[icon]}"/></svg>`;
}
