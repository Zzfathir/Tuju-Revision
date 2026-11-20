import { describe, expect, it } from "vitest";
import { validateStyleMin } from "@maplibre/maplibre-gl-style-spec";
import type { StyleSpecification } from "maplibre-gl";
import { COAST_BANDS, isNight, patchNightOps, pinGlyph, stopPin, type MapTokens } from "@/lib/night-ops";

const tokens: MapTokens = {
  "--map-land": "#0d0d0e", "--map-water": "#0b0b0c", "--map-coast-glow": "#d6d6d6", "--map-road-minor": "#4a4a4c",
  "--map-road-major": "#8a8a8d", "--map-road-motorway": "#b5b5b8", "--map-label": "#9a9a9d", "--map-building": "#1c1c1e",
};

const base = {
  version: 8,
  sources: { openmaptiles: { type: "vector", url: "https://tiles.openfreemap.org/planet" } },
  layers: [
    { id: "background", type: "background", paint: { "background-color": "#f8f4f0" } },
    { id: "landcover_wood", type: "fill", source: "openmaptiles", "source-layer": "landcover", paint: { "fill-color": "#9c9" } },
    { id: "water", type: "fill", source: "openmaptiles", "source-layer": "water", paint: { "fill-color": "#9cf" } },
    { id: "road_motorway_casing", type: "line", source: "openmaptiles", "source-layer": "transportation", paint: { "line-color": "#f00", "line-width": 3 } },
    { id: "road_motorway", type: "line", source: "openmaptiles", "source-layer": "transportation", paint: { "line-color": "#fa0", "line-width": 2 } },
    { id: "road_minor", type: "line", source: "openmaptiles", "source-layer": "transportation", paint: { "line-color": "#fff", "line-width": 1 } },
    { id: "railway", type: "line", source: "openmaptiles", "source-layer": "transportation", paint: { "line-color": "#999" } },
    { id: "boundary_state", type: "line", source: "openmaptiles", "source-layer": "boundary", paint: { "line-color": "#a0a" } },
    { id: "building-3d", type: "fill-extrusion", source: "openmaptiles", "source-layer": "building", minzoom: 14, paint: { "fill-extrusion-color": "#ddd" } },
    { id: "place_city", type: "symbol", source: "openmaptiles", "source-layer": "place", layout: { "text-field": "{name}" }, paint: { "text-color": "#000" } },
  ],
} as unknown as StyleSpecification;

type Loose = { paint: Record<string, unknown>; layout: Record<string, unknown>; minzoom: number };
const byId = (style: StyleSpecification, id: string) => style.layers.find((layer) => layer.id === id) as unknown as Loose;

describe("patchNightOps", () => {
  const style = patchNightOps(base, tokens);

  it("produces a valid style and leaves the input untouched", () => {
    expect(validateStyleMin(style as never)).toEqual([]);
    expect(byId(base, "background").paint["background-color"]).toBe("#f8f4f0");
  });
  it("paints land black, with no colour differences between land uses", () => {
    expect(byId(style, "background").paint["background-color"]).toBe("#0d0d0e");
    expect(byId(style, "landcover_wood").paint["fill-color"]).toBe("#0d0d0e");
    expect(byId(style, "water").paint["fill-color"]).toBe("#0b0b0c");
  });
  it("adds a multi-band coast glow right after the water, widest bands last, fading", () => {
    const ids = style.layers.map((layer) => layer.id);
    const start = ids.indexOf("water") + 1;
    expect(ids.slice(start, start + COAST_BANDS.length)).toEqual(COAST_BANDS.map((_, index) => "night-coast-glow-" + index));
    const opacities = COAST_BANDS.map(({ opacity }) => opacity);
    expect([...opacities].sort((a, b) => b - a)).toEqual(opacities);
  });
  it("uses a single glow layer in Lite mode and none when asked for none", () => {
    expect(patchNightOps(base, tokens, { bands: 1 }).layers.filter(({ id }) => id.startsWith("night-coast-glow"))).toHaveLength(1);
    expect(patchNightOps(base, tokens, { bands: 0 }).layers.filter(({ id }) => id.startsWith("night-coast-glow"))).toHaveLength(0);
  });
  it("greys the roads by class and hides casings, rail and boundaries", () => {
    const paint = (id: string) => byId(style, id).paint["line-color"];
    expect(paint("road_motorway")).toBe("#b5b5b8");
    expect(paint("road_minor")).toBe("#4a4a4c");
    for (const id of ["road_motorway_casing", "railway", "boundary_state"]) {
      expect(byId(style, id).layout.visibility).toBe("none");
    }
  });
  it("keeps 3D buildings subtle and late, and uppercases place names", () => {
    const building = byId(style, "building-3d");
    expect(building.minzoom).toBeGreaterThanOrEqual(14.5);
    expect(building.paint["fill-extrusion-opacity"]).toBeLessThanOrEqual(0.7);
    expect(byId(style, "place_city").layout["text-transform"]).toBe("uppercase");
  });
  it("dims a raster fallback instead", () => {
    const raster = { version: 8, sources: { street: { type: "raster", tiles: ["x"], tileSize: 256 } }, layers: [{ id: "street", type: "raster", source: "street" }] } as unknown as StyleSpecification;
    const dark = patchNightOps(raster, tokens);
    expect((dark.layers[0] as unknown as Loose).paint["raster-saturation"]).toBe(-1);
  });
});

describe("night preference", () => {
  it("is automatic while driving unless the user turned it off", () => {
    expect(isNight(null, false)).toBe(false);
    expect(isNight(null, true)).toBe(true);
    expect(isNight("off", true)).toBe(false);
    expect(isNight("on", false)).toBe(true);
  });
});

describe("pin categories", () => {
  const stop = (facilities: Partial<Record<"surau" | "evCharger" | "fuel", boolean | null>>, verified = true) =>
    ({ verified, facilities: { surau: null, toilet: null, fuel: null, evCharger: null, food: null, atm: null, ...facilities } });
  it("colours by confirmed facilities only", () => {
    expect(stopPin(stop({ evCharger: true, surau: true })).category).toBe("blue");
    expect(stopPin(stop({ surau: true })).category).toBe("green");
    expect(stopPin(stop({ fuel: true })).category).toBe("yellow");
  });
  it("marks a stop with nothing confirmed, or unverified data, as unverified", () => {
    expect(stopPin(stop({})).unverified).toBe(true);
    expect(stopPin(stop({ surau: true }, false)).unverified).toBe(true);
    expect(stopPin(stop({ surau: true })).unverified).toBe(false);
  });
  it("gives every icon markup", () => {
    for (const icon of ["surau", "bolt", "fuel", "alert", "flag", "start"] as const) expect(pinGlyph(icon)).toContain("<path");
  });
});
