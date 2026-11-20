"use client";

import { fmtDur, t, type Lang } from "@/lib/i18n";

export type OptionSummary = { id: string; duration_s: number; distance_m: number; verified: boolean };

/** Route alternatives as a list of cards: time first, then distance (Apple Maps / Waymo pattern). */
export function RouteOptions({ lang, options, selected, onSelect }: {
  lang: Lang; options: OptionSummary[]; selected: number; onSelect: (index: number) => void;
}) {
  const fastest = Math.min(...options.map((option) => option.duration_s));
  return <div className="route-options" role="radiogroup" aria-label={t(lang, "routesTitle")}>
    {options.map((option, index) => {
      const slower = Math.round((option.duration_s - fastest) / 60);
      return <button type="button" role="radio" aria-checked={index === selected} key={option.id} className="route-option"
        data-testid="route-option" data-selected={index === selected} onClick={() => onSelect(index)}>
        <span className="route-option-time">{fmtDur(option.duration_s / 60)}</span>
        <span className="route-option-meta">
          {Math.round(option.distance_m / 1000)} km · {slower <= 0 ? t(lang, "routeFastest") : t(lang, "routeAlt") + " " + t(lang, "routeSlower", { n: slower })}
        </span>
        {option.verified && <span className="route-option-badge">{t(lang, "verifiedRoad")}</span>}
      </button>;
    })}
  </div>;
}
