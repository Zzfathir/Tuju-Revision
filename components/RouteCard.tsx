"use client";

import type { ReactNode } from "react";
import { t, type Lang } from "@/lib/i18n";
import type { Place } from "@/lib/places";

/** The floating from → to card at the top of the map (Apple Maps / Google Maps pattern). */
export function RouteCard({ lang, from, to, onOpen, onSwap, children }: {
  lang: Lang; from: Place; to: Place; onOpen: (field: "from" | "to") => void; onSwap: () => void; children?: ReactNode;
}) {
  return <section className="route-card" aria-label={t(lang, "routesTitle")} data-testid="route-card">
    <p className="route-brand">{t(lang, "appName")}</p>
    <div className="route-rows">
      <span className="route-line" aria-hidden="true" />
      <button type="button" className="route-row" data-testid="route-from" aria-label={t(lang, "routeFrom") + ": " + from.name} onClick={() => onOpen("from")}>
        <span className="route-dot route-dot-from" aria-hidden="true" />
        <span className="route-name">{from.name}</span>
      </button>
      <button type="button" className="route-row" data-testid="route-to" aria-label={t(lang, "routeTo") + ": " + to.name} onClick={() => onOpen("to")}>
        <span className="route-dot route-dot-to" aria-hidden="true" />
        <span className="route-name">{to.name}</span>
      </button>
      <button type="button" className="route-swap" data-testid="route-swap" aria-label={t(lang, "swapPlaces")} onClick={onSwap}>⇅</button>
    </div>
    {children}
  </section>;
}
