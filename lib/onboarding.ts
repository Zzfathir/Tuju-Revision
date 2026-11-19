import type { Lang } from "./i18n";
import type { Need } from "./planner";

export type Prefs = { lang: Lang; vehicle: "petrol" | "ev"; needs: Need[] };
type Params = Record<string, string | string[] | undefined>;

const NEEDS: readonly Need[] = ["toilet", "surau", "ev", "food", "fuel"];
const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;

/** Reads trip preferences from URL parameters; anything invalid falls back to the default. */
export function parsePrefs(params: Params): Prefs {
  const raw = Array.isArray(params.needs) ? params.needs : [params.needs];
  const listed = raw.flatMap((item) => (item ?? "").split(","));
  return {
    lang: first(params.lang) === "bm" ? "bm" : "en",
    vehicle: first(params.vehicle) === "ev" ? "ev" : "petrol",
    needs: NEEDS.filter((need) => listed.includes(need)),
  };
}

/** Serializes non-default preferences (plus extras such as `t=1`) as a query string, or "". */
export function prefsQuery(prefs: Partial<Prefs>, extra: Record<string, string> = {}): string {
  const query = new URLSearchParams(extra);
  if (prefs.lang === "bm") query.set("lang", "bm");
  if (prefs.vehicle === "ev") query.set("vehicle", "ev");
  if (prefs.needs?.length) query.set("needs", prefs.needs.join(","));
  const text = query.toString();
  return text ? "?" + text : "";
}
