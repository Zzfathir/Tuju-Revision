import { lineString, simplify } from "@turf/turf";
import { z } from "zod";
import { inMalaysia } from "./bounds";

export type Point = { lat: number; lng: number };
export type RouteOption = { id: string; distance_m: number; duration_s: number; geometry: { type: "LineString"; coordinates: number[][] } };

export function parsePoint(text: string | null): Point | null {
  if (!text) return null;
  const parts = text.split(",");
  if (parts.length !== 2 || parts.some((part) => part.trim() === "")) return null;
  const [lat, lng] = parts.map(Number);
  if (!inMalaysia(lat, lng)) return null;
  const round = (value: number) => Math.round(value * 1e4) / 1e4;
  return { lat: round(lat), lng: round(lng) };
}

export const routeCacheKey = (from: Point, to: Point) => `route:${from.lat},${from.lng}>${to.lat},${to.lng}`;

export const OsrmResponse = z.object({
  code: z.string(),
  routes: z.array(z.object({
    distance: z.number(), duration: z.number(),
    geometry: z.object({ type: z.literal("LineString"), coordinates: z.array(z.array(z.number()).min(2)) }),
  })).default([]),
});

/** OSRM to up to three route options, with the line thinned to about 30 m so phones can draw it. */
export function normalizeOsrm(json: unknown): RouteOption[] {
  const parsed = OsrmResponse.safeParse(json);
  if (!parsed.success || parsed.data.code !== "Ok") return [];
  return parsed.data.routes.slice(0, 3).map((route, index) => {
    const thin = route.geometry.coordinates.length > 2
      ? simplify(lineString(route.geometry.coordinates), { tolerance: 0.0003, highQuality: false }).geometry.coordinates
      : route.geometry.coordinates;
    return { id: "r" + index, distance_m: route.distance, duration_s: route.duration, geometry: { type: "LineString", coordinates: thin } };
  });
}
