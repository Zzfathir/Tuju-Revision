"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { driveProgress } from "@/lib/drive-progress";
import { t, type Lang } from "@/lib/i18n";
import type { Stop } from "@/lib/schemas";

export function DriveHud({ lang, mode, destination, km, offRouteM, routeKm, stops, onExit, tollInfo }: {
  lang: Lang; mode: "gps" | "sim" | "finished"; destination: string;
  km: number | null; offRouteM: number; routeKm: number; stops: Stop[]; onExit: () => void; tollInfo?: ReactNode;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, []);

  const progress = driveProgress(km, offRouteM, routeKm, stops);
  const simulated = mode !== "gps";
  const remaining = progress.state === "moving" ? Math.ceil(progress.remainingKm) : progress.state === "arrived" ? 0 : null;
  const next = progress.state === "moving" ? progress.next : undefined;

  return <section className="drive-hud" data-testid="screen-drive" aria-labelledby="drive-heading">
    <div className="drive-instruction">
      <h2 id="drive-heading" className="drive-mode" ref={heading} tabIndex={-1}>{t(lang, simulated ? "simulation" : "driveView")}</h2>
      {progress.state === "moving" ? <>
        <div className="drive-next">
          <strong data-testid="drive-next-distance">{Math.ceil(next?.distanceKm ?? progress.remainingKm)} <span>km</span></strong>
          <div>
            <p className="drive-context">{t(lang, next ? "driveNextPlanned" : "driveDestination")}</p>
            <p className="drive-place" data-testid="drive-next-name">{next?.stop.name ?? destination}</p>
          </div>
        </div>
      </> : <p className="drive-message" role="status" data-testid="drive-status">
        {progress.state === "off-route" ? t(lang, "offRoute", { n: progress.distanceKm.toFixed(1) })
          : t(lang, progress.state === "arrived" ? "arrived" : "driveLocating")}
      </p>}
    </div>
    <div className="drive-summary" data-testid="drive-progress">
      {progress.state === "moving" && tollInfo && <p className="drive-toll">{tollInfo}</p>}
      {remaining !== null && <div className="drive-metrics">
        <span><strong>{remaining} km</strong> {t(lang, "driveRemaining")}</span>
        <progress className="drive-progress" aria-label={t(lang, "driveProgressLabel")} max={1}
          value={progress.state === "moving" ? progress.fraction : 1} />
      </div>}
      <button type="button" className="btn drive-end" data-testid={simulated ? "btn-stop-replay" : "btn-stop-drive"}
        onClick={onExit}>{t(lang, mode === "finished" ? "endSimulation" : simulated ? "stopSimulation" : "driveEnd")}</button>
    </div>
  </section>;
}
