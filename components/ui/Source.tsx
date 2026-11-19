import type { SourceStatus } from "@/lib/schemas";
import { fmtTime, t, type Lang } from "@/lib/i18n";

export function Source({ label, ts, status, maxAge, now, url, lang = "en" }: {
  label: string; ts?: string; status?: SourceStatus; maxAge?: number; now?: number; url?: string; lang?: Lang;
}) {
  const time = ts ? Date.parse(ts) : NaN;
  const stale = (status === "live" || status === "cached") && maxAge != null && now != null
    && (!Number.isFinite(time) || now - time > maxAge);
  const state = stale ? "stale" : status;
  const date = Number.isFinite(time) && ts
    ? ts.length === 10 ? ts : new Date(time + 8 * 3600_000).toISOString().slice(0, 10) + " " + fmtTime(new Date(time))
    : undefined;
  const statusLabel = state ? t(lang, state === "offline" ? "statusOffline" : state) : undefined;
  const contents = "[" + [label, date, statusLabel].filter(Boolean).join(" · ") + "]";
  return url
    ? <a className="source" data-testid="badge-source" data-status={state} href={url}>{contents}</a>
    : <span className="source" data-testid="badge-source" data-status={state}>{contents}</span>;
}
