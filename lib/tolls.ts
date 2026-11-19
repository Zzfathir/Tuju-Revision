import type { TollFile } from "./schemas";

export type TollQuote =
  | { ok: true; fare: number; verified: boolean; entry: string; exit: string }
  | { ok: false; reason: "same-plaza" | "wrong-direction" | "unknown-fare"; entry: string; exit: string };

/** Closed-system toll: fare is looked up by (entry, exit). Never estimated or interpolated. */
export function quoteToll(t: TollFile, entryId: string, exitId: string): TollQuote {
  const entry = t.plazas.find((p) => p.id === entryId);
  const exit = t.plazas.find((p) => p.id === exitId);
  const names = { entry: entry?.name ?? entryId, exit: exit?.name ?? exitId };
  if (!entry || !exit || entryId === exitId) return { ok: false, reason: "same-plaza", ...names };
  if (exit.distanceAlongRoute_km <= entry.distanceAlongRoute_km) return { ok: false, reason: "wrong-direction", ...names };
  const fare = t.fares[entryId]?.[exitId];
  if (fare == null) return { ok: false, reason: "unknown-fare", ...names };
  return { ok: true, fare, verified: t.verified, ...names };
}

/** Plazas ahead of the given km (for live mode "toll ahead"). */
export function plazasAhead(t: TollFile, km: number) {
  return t.plazas.filter((p) => p.distanceAlongRoute_km > km + 0.05);
}
