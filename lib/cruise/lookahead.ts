import type { Need } from "../planner";
import type { FacilityKey, Stop, TollFile } from "../schemas";
import type { CruiseConfig } from "./config";

export type EventKind = "toll" | "rnr" | "break";
export type VoiceLevel = "full" | "normal" | "reduced";
export type AlertLevel = 1 | 2 | 3;

/** Something ahead on the route that may deserve an alert. `km` is distance along the route. */
export type RouteEvent = {
  id: string; kind: EventKind; name: string; km: number;
  /** One of the tester's planned stops. */
  planned: boolean;
  /** False for events the tester has filtered out: they raise nothing. */
  relevant: boolean;
  /** Confirmed-true facilities only, as short keys (surau, toilet, fuel, ev, food, atm). */
  facilities: string[];
};

export type Alert = { event: RouteEvent; level: AlertLevel; distKm: number; etaS: number };
export type Utterance = { id: string; kind: EventKind; name: string; level: 2 | 3; distKm: number; facilities: string[]; planned: boolean; interrupt: boolean };
export type LookaheadInput = { km: number; speedMps: number; now: number; voice: VoiceLevel; muted: boolean };
export type LookaheadResult = {
  alerts: Alert[];
  /** Levels reached for the first time on this update, for UI timers (L2 cards dismiss themselves). */
  reached: { id: string; level: AlertLevel }[];
  speak: Utterance | null;
  cardsSuppressed: boolean;
};

const NEED_FACILITY: Record<Need, FacilityKey> = { surau: "surau", toilet: "toilet", food: "food", fuel: "fuel", ev: "evCharger" };
const FACILITY_KEY: Record<FacilityKey, string> = { surau: "surau", toilet: "toilet", fuel: "fuel", evCharger: "ev", food: "food", atm: "atm" };
const PASSED_KM = -0.05;

/** Tolls always count; a stop counts if it is planned or has a confirmed facility the tester asked for. Sorted by km. */
export function buildEvents({ plazas, stops, plannedIds, needs }: {
  plazas: TollFile["plazas"]; stops: Stop[]; plannedIds: string[]; needs: Partial<Record<Need, boolean>>;
}): RouteEvent[] {
  const wanted = (Object.keys(needs) as Need[]).filter((need) => needs[need]);
  const events: RouteEvent[] = plazas.map((plaza) => ({
    id: plaza.id, kind: "toll", name: plaza.name, km: plaza.distanceAlongRoute_km, planned: false, relevant: true, facilities: [],
  }));
  for (const stop of stops) {
    const planned = plannedIds.includes(stop.id);
    const matches = wanted.some((need) => stop.facilities[NEED_FACILITY[need]] === true);
    events.push({
      id: stop.id, kind: stop.id.startsWith("break-") ? "break" : "rnr", name: stop.name, km: stop.distanceAlongRoute_km,
      planned, relevant: planned || matches,
      facilities: (Object.keys(stop.facilities) as FacilityKey[]).filter((key) => stop.facilities[key] === true).map((key) => FACILITY_KEY[key]),
    });
  }
  return events.sort((a, b) => a.km - b.km);
}

/**
 * Predictive alerts. L1 chip at 5 km, L2 card at 2 km, L3 banner at 500 m or 30 s. Each level fires once per event.
 * Voice: one line per cooldown window; L3 may interrupt an L1/L2 line; a line blocked by the cooldown is retried, not lost.
 * Pure: the caller supplies the clock, so the same logic runs on a phone and in a fast simulation.
 */
export function createLookahead(events: RouteEvent[], cfg: Pick<CruiseConfig, "alerts" | "minEtaSpeed" | "voiceCooldownS" | "cardSuppressKmh">) {
  const reachedLevels = new Map<string, Set<AlertLevel>>();
  const voiced = new Map<string, Set<AlertLevel>>();
  let lastVoiceAt = -Infinity;
  let lastVoiceLevel: AlertLevel = 1;
  const mark = (store: Map<string, Set<AlertLevel>>, id: string, upTo: AlertLevel) => {
    const set = store.get(id) ?? new Set<AlertLevel>();
    for (const level of [1, 2, 3] as const) if (level <= upTo) set.add(level);
    store.set(id, set);
  };

  return {
    update({ km, speedMps, now, voice, muted }: LookaheadInput): LookaheadResult {
      const effectiveSpeed = Math.max(speedMps, cfg.minEtaSpeed);
      const alerts: Alert[] = [];
      for (const event of events) {
        if (!event.relevant) continue;
        const distKm = event.km - km;
        if (distKm < PASSED_KM || distKm > cfg.alerts.l1Km) continue;
        const etaS = (distKm * 1000) / effectiveSpeed;
        const level: AlertLevel = distKm <= cfg.alerts.l3Km || etaS <= cfg.alerts.l3EtaS ? 3 : distKm <= cfg.alerts.l2Km ? 2 : 1;
        alerts.push({ event, level, distKm, etaS });
      }
      alerts.sort((a, b) => a.distKm - b.distKm);

      const reached: LookaheadResult["reached"] = [];
      for (const { event, level } of alerts) {
        const seen = reachedLevels.get(event.id) ?? new Set<AlertLevel>();
        for (const l of [1, 2, 3] as const) if (l <= level && !seen.has(l)) reached.push({ id: event.id, level: l });
        mark(reachedLevels, event.id, level);
      }

      // Voice: highest level first, then nearest. Events that may not be spoken are marked done silently so they never speak late.
      let speak: Utterance | null = null;
      const candidates = alerts.filter((a) => a.level >= 2 && !voiced.get(a.event.id)?.has(a.level))
        .sort((a, b) => b.level - a.level || a.distKm - b.distKm);
      for (const { event, level, distKm } of candidates) {
        const allowed = !muted && (voice === "full"
          || (voice === "normal" && (event.kind !== "rnr" || event.planned || level === 3))
          || (voice === "reduced" && level === 3));
        if (!allowed) { mark(voiced, event.id, level); continue; }
        if (speak) continue; // one line per update
        const outsideCooldown = now - lastVoiceAt >= cfg.voiceCooldownS * 1000;
        const interrupts = level === 3 && lastVoiceLevel < 3;
        if (!outsideCooldown && !interrupts) continue; // deferred: retried on a later update
        speak = {
          id: event.id, kind: event.kind, name: event.name, level: level as 2 | 3, distKm,
          facilities: event.facilities, planned: event.planned, interrupt: !outsideCooldown,
        };
        mark(voiced, event.id, level);
        lastVoiceAt = now;
        lastVoiceLevel = level;
      }

      return { alerts, reached, speak, cardsSuppressed: speedMps * 3.6 > cfg.cardSuppressKmh };
    },
  };
}
