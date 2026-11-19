import { Card } from "@/components/ui/Card";
import { Source } from "@/components/ui/Source";
import { t } from "@/lib/i18n";

const samples = [
  ["default", "live", "Weather update received."],
  ["loading", "cached", t("en", "loading")],
  ["empty", "live", t("en", "forecastNone")],
  ["error", "estimate", t("en", "unavailable")],
  ["offline", "offline", t("en", "offline", { t: "2026-11-20 10:42 MYT" })],
  ["stale", "stale", t("en", "weatherCachedNone")],
  ["unverified", "unverified", t("en", "tollUnknown")],
] as const;

export default function States() {
  return <main className="page stack" data-testid="screen-states">
    <h1>Wireframe states</h1>
    {samples.map(([state, status, message]) =>
      <Card key={state} id={"state-" + state} state={state} title={state} source={<Source label="Example source" status={status} ts="2026-11-20T10:42:00+08:00" />}>
        <p className={state === "offline" ? "banner" : undefined} data-kind={state}>{message}</p>
        {state === "error" && <a href="/states" className="btn">{t("en", "retry")}</a>}
        {state === "unverified" && <div className="row">{[true, false, null].map((value) =>
          <span className="badge" key={String(value)} data-on={String(value)}>{t("en", "toilet")}</span>)}</div>}
      </Card>)}
    <div className="row"><a className="btn" data-variant="primary" href="/">Open Plan</a><button type="button" className="btn" disabled>Unavailable</button></div>
    <div className="placeholder">[ TRIP CARD IMAGE 1080×1350 ]</div>
  </main>;
}
