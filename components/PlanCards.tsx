"use client";

import { useState } from "react";
import { Card } from "./ui/Card";
import { Source } from "./ui/Source";
import { calendarEvent, departureOptions } from "@/lib/departure";
import type { EtaGrid } from "@/lib/eta-grid";
import { fmtDur, t, type Lang } from "@/lib/i18n";
import { quoteToll } from "@/lib/tolls";
import type { RouteConfig, TollFile } from "@/lib/schemas";

export function TollPicker({ tolls, entry, exit, setEntry, setExit, lang }: {
  tolls: TollFile; entry: string; exit: string; setEntry: (id: string) => void; setExit: (id: string) => void; lang: Lang;
}) {
  const quote = quoteToll(tolls, entry, exit);
  const options = tolls.plazas.map((plaza) => <option key={plaza.id} value={plaza.id}>{plaza.name}</option>);
  return <Card id="card-toll" title={t(lang, "tollTitle")} source={<Source label="PLUS" url={tolls.source_url}
    ts={tolls.retrieved_at} status={quote.ok && quote.verified ? undefined : "unverified"} lang={lang} />}>
    <label className="field">{t(lang, "tollEntry")}
      <select className="select" data-testid="toll-entry" value={entry} onChange={(event) => setEntry(event.target.value)}>{options}</select>
    </label>
    <label className="field">{t(lang, "tollExit")}
      <select className="select" data-testid="toll-exit" value={exit} onChange={(event) => setExit(event.target.value)}>{options}</select>
    </label>
    <p aria-live="polite"><strong>{quote.ok ? t(lang, "tollTotal", { n: quote.fare.toFixed(2) }) :
      t(lang, quote.reason === "unknown-fare" ? "tollUnknown" : "tollWrongWay")}</strong></p>
    <p className="small">{t(lang, "classOne")}</p>
    <p className="small">{t(lang, "plannedPlazas", { entry: tolls.plazas[0]?.name ?? "—", exit: tolls.plazas.at(-1)?.name ?? "—" })}</p>
    <a className="btn" href={tolls.source_url}>{t(lang, "checkPlus")}</a>
  </Card>;
}

export function LeaveTimeBar({ config, departure, setDeparture, baseMinutes, eta, lang }: {
  config: RouteConfig; departure: string; setDeparture: (value: string) => void;
  baseMinutes: number; eta?: EtaGrid; lang: Lang;
}) {
  const [festive, setFestive] = useState(true);
  const [selected, setSelected] = useState("");
  const date = departure.slice(0, 10);
  const options = departureOptions(config.id, date, baseMinutes, festive, eta);
  const best = options.slots.reduce((a, b) => a.duration_min <= b.duration_min ? a : b);
  const active = options.slots.find((slot) => slot.depart === selected) ?? best;
  const save = () => {
    const file = new Blob([calendarEvent(config.name[lang], new Date(date + "T" + active.depart + ":00+08:00"), active.duration_min)], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = "jalan-pulang.ics";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <Card id="card-leave" title={t(lang, "leaveTitle")} source={<Source label={options.label}
    url={options.url} ts={options.ts} status="estimate" lang={lang} />}>
    {!options.predicted && <div className="seg">
      <button type="button" className="btn" aria-pressed={festive} onClick={() => setFestive(true)}>{t(lang, "festiveDay")}</button>
      <button type="button" className="btn" aria-pressed={!festive} onClick={() => setFestive(false)}>{t(lang, "normalDay")}</button>
    </div>}
    <p><strong>{t(lang, "leaveBest", { t: best.depart, d: fmtDur(best.duration_min) })}</strong></p>
    <div className="leavebar" role="group" aria-label={t(lang, "departure")}>
      {options.slots.map((slot) => {
        const ratio = slot.duration_min / best.duration_min;
        return <button type="button" key={slot.depart} data-level={1 + Number(ratio > 1.1) + Number(ratio > 1.35) + Number(ratio > 1.7)}
          data-best={slot.depart === best.depart} aria-pressed={active.depart === slot.depart}
          aria-label={slot.depart + " · " + fmtDur(slot.duration_min)} onClick={() => setSelected(slot.depart)}>{slot.depart}</button>;
      })}
    </div>
    <p aria-live="polite">{active.depart} · {fmtDur(active.duration_min)}</p>
    <div className="row">
      <button type="button" className="btn" onClick={() => setDeparture(date + "T" + active.depart)}>{t(lang, "useThisTime")}</button>
      <button type="button" className="btn" onClick={save}>{t(lang, "addCalendar")}</button>
    </div>
    <p className="small">{t(lang, options.predicted ? "predictionNote" : "adviceNote")} {config.links.operatorTta && <a href={config.links.operatorTta}>MyPLUS-TTA</a>}</p>
  </Card>;
}
