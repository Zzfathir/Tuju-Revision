import { z } from "zod";

/** Provenance is mandatory on every data file. */
export const Provenance = z.object({
  source_url: z.string().url(),
  retrieved_at: z.string(),
  verified: z.boolean(),
});

const TriState = z.boolean().nullable(); // null = unknown (never coerce to false)

export const Facilities = z.object({
  surau: TriState,
  toilet: TriState,
  fuel: TriState,
  evCharger: TriState,
  food: TriState,
  atm: TriState,
});
export type Facilities = z.infer<typeof Facilities>;
export type FacilityKey = keyof Facilities;

export const Stop = Provenance.extend({
  id: z.string(),
  name: z.string(),
  kind: z.enum(["rnr", "layby"]),
  direction: z.string(),
  lat: z.number(),
  lng: z.number(),
  distanceAlongRoute_km: z.number(),
  facilities: Facilities,
});
export type Stop = z.infer<typeof Stop>;

export const RnrFile = Provenance.extend({ routeId: z.string(), source: z.string(), items: z.array(Stop) });

export const TollPlaza = z.object({
  id: z.string(),
  name: z.string(),
  lat: z.number(),
  lng: z.number(),
  distanceAlongRoute_km: z.number(),
  /** open = ticketed closed-system entry/exit; barrier = flat-fare mainline plaza */
  type: z.enum(["closed-entry-exit", "barrier"]),
});
export const TollFile = Provenance.extend({
  routeId: z.string(),
  vehicleClass: z.string(),
  currency: z.literal("MYR"),
  note: z.string(),
  plazas: z.array(TollPlaza),
  /** fares[entryId][exitId] = RM, or null if not confirmed */
  fares: z.record(z.record(z.number().nullable())),
});
export type TollFile = z.infer<typeof TollFile>;

export const RouteConfig = z.object({
  id: z.string(),
  name: z.object({ en: z.string(), bm: z.string() }),
  highway: z.string(),
  direction: z.string(),
  origin: z.object({ name: z.string(), lat: z.number(), lng: z.number() }),
  destination: z.object({ name: z.string(), lat: z.number(), lng: z.number() }),
  via: z.array(z.object({ name: z.string(), lat: z.number(), lng: z.number() })).default([]),
  prayerZones: z.array(z.object({ zone: z.string(), label: z.string(), fromKm: z.number() })),
  weatherLocations: z.array(z.string()),
  links: z.record(z.string()),
});
export type RouteConfig = z.infer<typeof RouteConfig>;

// ---------- External API payloads ----------
export const MetWarning = z.object({
  warning_issue: z.object({ issued: z.string(), title_bm: z.string().nullable(), title_en: z.string().nullable() }),
  valid_from: z.string().nullable(),
  valid_to: z.string().nullable(),
  heading_en: z.string().nullable().optional(),
  text_en: z.string().nullable().optional(),
  text_bm: z.string().nullable().optional(),
});
export const MetWarnings = z.array(MetWarning);

export const MetForecast = z.object({
  location: z.object({ location_id: z.string(), location_name: z.string() }),
  date: z.string(),
  morning_forecast: z.string(),
  afternoon_forecast: z.string(),
  night_forecast: z.string(),
  summary_forecast: z.string(),
  summary_when: z.string(),
  min_temp: z.number(),
  max_temp: z.number(),
});
export const MetForecasts = z.array(MetForecast);

export const ESolat = z.object({
  status: z.string(),
  zone: z.string(),
  serverTime: z.string().optional(),
  prayerTime: z.array(
    z.object({ date: z.string(), dhuhr: z.string(), asr: z.string(), maghrib: z.string(), isha: z.string(), fajr: z.string() }),
  ).min(1),
});

export const SourceStatus = z.enum(["live", "cached", "estimate", "unverified", "stale", "offline"]);
export type SourceStatus = z.infer<typeof SourceStatus>;
