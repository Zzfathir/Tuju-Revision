import type { PrayerWindow } from "./planner";

export type DayTimes = { date: string; zone: string; fajr: string; dhuhr: string; asr: string; maghrib: string; isha: string };
export type PrayerSource = { label: string; status: "live" | "cached" | "estimate"; fetchedAt: string };

/**
 * Fallback when e-Solat is unreachable: APPROXIMATE times for Selangor/Perak (late Nov).
 * Derived from the saved e-Solat fixtures (PRK02/SGR01, 20 Nov 2026) and rounded to 5 min.
 * Always shown with status "estimate". Drift is ~1 min/week, so it is only for demo resilience.
 */
export const APPROX: Record<string, Omit<DayTimes, "date" | "zone">> = {
  SGR01: { fajr: "05:50", dhuhr: "13:00", asr: "16:25", maghrib: "19:00", isha: "20:10" },
  WLY01: { fajr: "05:50", dhuhr: "13:00", asr: "16:25", maghrib: "19:00", isha: "20:10" },
  PRK02: { fajr: "05:55", dhuhr: "13:05", asr: "16:25", maghrib: "19:00", isha: "20:15" },
};

const at = (date: string, hhmm: string) => new Date(`${date}T${hhmm.slice(0, 5)}:00+08:00`);

/** Zohor ends at Asar, Asar at Maghrib, Maghrib at Isyak. */
export function windowsFor(t: DayTimes): PrayerWindow[] {
  return [
    { name: "Zohor", start: at(t.date, t.dhuhr), end: at(t.date, t.asr) },
    { name: "Asar", start: at(t.date, t.asr), end: at(t.date, t.maghrib) },
    { name: "Maghrib", start: at(t.date, t.maghrib), end: at(t.date, t.isha) },
  ];
}

/** e-Solat date is "20-Nov-2026" → "2026-11-20" */
export function esolatDateToIso(d: string) {
  const m: Record<string, string> = { Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06", Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12" };
  const [dd, mon, yyyy] = d.split("-");
  return `${yyyy}-${m[mon] ?? "01"}-${dd.padStart(2, "0")}`;
}

/** Malaysia (UTC+8) calendar date for a JS Date */
export const myDate = (d: Date) => new Date(d.getTime() + 8 * 3600_000).toISOString().slice(0, 10);
