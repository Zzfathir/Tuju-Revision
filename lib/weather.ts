import type { z } from "zod";
import type { MetForecast, MetWarning } from "./schemas";
import type { Gazetteer } from "./data";

type Warning = z.infer<typeof MetWarning>;
type Forecast = z.infer<typeof MetForecast>;

export type CorridorWarning = {
  title_en: string; title_bm: string; issued: string; valid_to: string | null;
  matched: string[]; // place names that matched (best-effort text match)
  scope: "corridor" | "state";
  text_en: string;
  text_bm: string;
};

const STATE_ALIASES: Record<string, RegExp> = {
  "WP Kuala Lumpur": /kuala lumpur|wilayah persekutuan/i,
  Selangor: /selangor/i,
  Perak: /\bperak\b/i,
};

/**
 * MET warnings are free text, not polygons → best-effort matching:
 * 1) district/town name match (Gombak, Hulu Selangor, Batang Padang, Kinta…) → "corridor"
 * 2) else a state match (Selangor/Perak/KL) → "state"
 * Marine-only warnings ("Strong Winds and Rough Seas") are excluded — not relevant to a highway drive.
 */
export function matchWarnings(warnings: Warning[], gaz: Gazetteer, now = new Date()): CorridorWarning[] {
  const names = [...new Set(gaz.places.map((p) => p.name))];
  const states = [...new Set(gaz.places.map((p) => p.state))];
  const out: CorridorWarning[] = [];
  for (const w of warnings) {
    const title = w.warning_issue.title_en ?? "";
    if (/no advisory/i.test(title)) continue;
    if (/rough seas|seas warning|marine/i.test(title)) continue;
    if (w.valid_to && new Date(w.valid_to + "+08:00") < now) continue;
    const text = `${w.text_en ?? ""} ${w.text_bm ?? ""}`;
    const matched = names.filter((n) => new RegExp(`\\b${n}\\b`, "i").test(text));
    const stateMatched = states.filter((s) => STATE_ALIASES[s]?.test(text));
    if (!matched.length && !stateMatched.length) continue;
    out.push({
      title_en: title,
      title_bm: w.warning_issue.title_bm ?? title,
      issued: w.warning_issue.issued,
      valid_to: w.valid_to,
      matched: matched.length ? matched : stateMatched,
      scope: matched.length ? "corridor" : "state",
      text_en: (w.text_en ?? "").slice(0, 600),
      text_bm: (w.text_bm ?? "").slice(0, 600),
    });
  }
  return out;
}

/** Forecast for corridor districts on a given date, ordered along the route. */
export function corridorForecast(forecasts: Forecast[], gaz: Gazetteer, date: string) {
  const seen = new Set<string>();
  const out: (Forecast & { km: number })[] = [];
  for (const p of [...gaz.places].sort((a, b) => a.km - b.km)) {
    if (seen.has(p.id)) continue;
    const f = forecasts.find((x) => x.location.location_id === p.id && x.date === date);
    if (f) { out.push({ ...f, km: p.km }); seen.add(p.id); }
  }
  return out;
}

export const isStormy = (s: string) => /ribut petir|thunderstorm|hujan lebat|heavy rain/i.test(s);
