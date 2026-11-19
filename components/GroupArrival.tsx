"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import type { GroupAction, GroupView } from "@/lib/group-arrival";
import { groupCopy } from "@/lib/group-copy";
import { groupTime, myTimeInput, parseMyTime } from "@/lib/group-time";
import { t, type Lang } from "@/lib/i18n";
import { Card } from "./ui/Card";

const api = "/api/group-arrival";
const credentialPattern = /^[a-f0-9]{32}$/;

async function send<T>(id?: string, token?: string, body?: object): Promise<T> {
  const headers = new Headers();
  if (token) headers.set("Authorization", "Bearer " + token);
  if (body) headers.set("Content-Type", "application/json");
  const response = await fetch(id && !body ? api + "?id=" + id : api, {
    headers, cache: "no-store", method: body ? "POST" : "GET",
    body: body ? JSON.stringify({ ...body, id }) : undefined,
    signal: AbortSignal.timeout(12_000),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error);
  return result;
}

function errorText(lang: Lang, error: unknown) {
  switch (error instanceof Error ? error.message : "") {
    case "missing": return groupCopy(lang, "closed");
    case "busy": return groupCopy(lang, "busy");
    case "full": return groupCopy(lang, "full");
    case "forbidden": return groupCopy(lang, "forbidden");
    case "invalid-time": return groupCopy(lang, "timeError");
    case "invalid": return groupCopy(lang, "invalid");
    default: return groupCopy(lang, "unavailable");
  }
}

const roomPath = (id: string, lang: Lang) => "/group-arrival/" + id + (lang === "bm" ? "?lang=bm" : "");
const credentialKey = (id: string) => "jalan-pulang-group-" + id;

function readCredential(id: string) {
  try { return localStorage.getItem(credentialKey(id)) ?? undefined; }
  catch { return undefined; }
}

function saveCredential(id: string, token: string) {
  try {
    localStorage.setItem(credentialKey(id), token);
    return true;
  } catch { return false; }
}

function guestToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (value) => value.toString(16).padStart(2, "0")).join("");
}

export function GroupCreate({ lang, defaultStart }: { lang: Lang; defaultStart: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const label = (key: Parameters<typeof groupCopy>[1]) => groupCopy(lang, key);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const values = new FormData(event.currentTarget);
    try {
      const result = await send<{ id: string; host: string }>(undefined, undefined, {
        action: "create", title: values.get("title"), venue: values.get("venue"), startAt: parseMyTime(String(values.get("start"))),
      });
      saveCredential(result.id, result.host);
      location.assign(roomPath(result.id, lang) + "#host=" + result.host);
    } catch (failure) {
      setError(errorText(lang, failure));
      setBusy(false);
    }
  }

  return <main className="page stack group-page" lang={lang === "bm" ? "ms" : "en"}>
    <a className="btn" href="/plan">{t(lang, "backToPlan")}</a>
    <h1>{label("title")}</h1>
    <p>{label("intro")}</p>
    <form className="card stack" onSubmit={create}>
      <label className="field">{label("name")}<input className="input" name="title" maxLength={70} required /></label>
      <label className="field">{label("venue")}<input className="input" name="venue" maxLength={120} required /></label>
      <label className="field">{label("start")}<input className="input" name="start" type="datetime-local" defaultValue={defaultStart} required /></label>
      <button className="btn" data-variant="primary" disabled={!ready || busy}>{label("create")}</button>
      {error && <p role="alert">{error}</p>}
    </form>
    <p className="small muted">{label("privacy")}</p>
  </main>;
}

export function GroupRoom({ id, lang }: { id: string; lang: Lang }) {
  const token = useRef<string | undefined>(undefined);
  const sequence = useRef(0);
  const recovery = useRef<string | undefined>(undefined);
  const mutating = useRef(false);
  const admitted = useRef(false);
  const [room, setRoom] = useState<GroupView>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [invite, setInvite] = useState("");
  const [manualLink, setManualLink] = useState<{ url: string; private: boolean }>();
  const [reporting, setReporting] = useState(false);
  const [changing, setChanging] = useState(false);
  const label = (key: Parameters<typeof groupCopy>[1]) => groupCopy(lang, key);

  const accept = useCallback((view: GroupView) => {
    admitted.current = view.isHost || view.you !== null;
    setRoom(view);
    setError("");
  }, []);

  const refresh = useCallback(async () => {
    if (mutating.current) return;
    const ticket = ++sequence.current;
    try {
      if (recovery.current) {
        const proposed = recovery.current;
        const view = await send<GroupView>(id, proposed);
        if (ticket !== sequence.current) return;
        recovery.current = undefined;
        if (view.isHost) {
          token.current = proposed;
          if (saveCredential(id, proposed)) history.replaceState(history.state, "", roomPath(id, lang));
          accept(view);
          return;
        }
        history.replaceState(history.state, "", roomPath(id, lang));
      }
      const view = await send<GroupView>(id, token.current);
      if (ticket === sequence.current) accept(view);
    } catch (failure) {
      if (ticket === sequence.current) {
        if (failure instanceof Error && failure.message === "missing") {
          admitted.current = false;
          setRoom(undefined);
        }
        setError(errorText(lang, failure));
      }
    }
  }, [accept, id, lang]);

  useEffect(() => {
    token.current = readCredential(id);
    const path = roomPath(id, lang);
    const link = new URLSearchParams(location.hash.slice(1)).get("host");
    if (link && credentialPattern.test(link) && link !== token.current) recovery.current = link;
    else if (location.hash) history.replaceState(history.state, "", path);
    setInvite(location.origin + path);
    void refresh();
    const tick = () => {
      if (document.visibilityState === "visible" && admitted.current) void refresh();
    };
    const timer = window.setInterval(tick, 30_000);
    window.addEventListener("focus", tick);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", tick);
      sequence.current++;
    };
  }, [id, lang, refresh]);

  async function update(action: GroupAction) {
    if (mutating.current) return;
    mutating.current = true;
    sequence.current++;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (action.action === "join" && !token.current) {
        token.current = guestToken();
        saveCredential(id, token.current);
      }
      accept(await send<GroupView>(id, token.current, action));
      setNotice(label("saved"));
      setReporting(false);
      setChanging(false);
    } catch (failure) {
      setError(errorText(lang, failure));
    } finally {
      setBusy(false);
      mutating.current = false;
    }
  }

  async function copy(url: string, privateLink = false) {
    setManualLink(undefined);
    try {
      await navigator.clipboard.writeText(url);
      setNotice(label("copied"));
    } catch {
      setManualLink({ url, private: privateLink });
      setNotice(label("copyFailed"));
    }
  }

  const bm = lang === "bm";
  return <main className="page stack group-page" lang={bm ? "ms" : "en"}>
    <a className="btn" href={"/group-arrival" + (bm ? "?lang=bm" : "")}>{label("title")}</a>
    {!room ? <><p role={error ? "alert" : "status"}>{error || t(lang, "loading")}</p>
      {error && <button type="button" className="btn" onClick={() => void refresh()}>{label("refresh")}</button>}</> : <>
      <header className="stack">
        <h1>{room.title}</h1>
        <p>{room.venue}</p>
        <p><strong>{label("start")} · {groupTime(room.startAt, lang, true)}</strong></p>
        {room.previousStartAt !== null && <p className="banner">{bm ? "Masa mula dikemas kini" : "Start time changed"} · {groupTime(room.previousStartAt, lang, true)} → {groupTime(room.startAt, lang, true)}</p>}
        <div className="row">
          <button type="button" className="btn" disabled={!invite} onClick={() => void copy(invite)}>{label("copy")}</button>
          <button type="button" className="btn" disabled={busy} onClick={() => void refresh()}>{label("refresh")}</button>
        </div>
      </header>
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {manualLink && <label className="field">{label(manualLink.private ? "hostLink" : "invite")}
        <input className="input" readOnly value={manualLink.url} onFocus={(event) => event.target.select()} />
      </label>}
      {room.jams.map((jam) => <section className="banner stack" key={jam.stretch} aria-label={label("delayed")}>
        <h2>{jam.stretch}</h2>
        <p>{bm ? jam.count + " tetamu melaporkan trafik di kawasan ini." : jam.count + " guests reported traffic in this area."}</p>
        <p>{label("eta")} · {groupTime(jam.earliest, lang, true)}{jam.latest !== jam.earliest ? " – " + groupTime(jam.latest, lang, true) : ""}</p>
      </section>)}
      {!room.isHost && !room.you && <form className="card stack" onSubmit={(event) => {
        event.preventDefault();
        void update({ action: "join", nickname: String(new FormData(event.currentTarget).get("nickname")) });
      }}>
        <label className="field">{label("nickname")}<input className="input" name="nickname" required maxLength={30} autoComplete="nickname" /></label>
        <button className="btn" data-variant="primary" disabled={busy}>{label("join")}</button>
      </form>}
      {room.you && <Card id="group-your-arrival" title={room.you.nickname}>
        <div className="row">
          <button type="button" className="btn" data-variant="primary" aria-expanded={reporting} disabled={busy} onClick={() => setReporting(!reporting)}>{label("report")}</button>
          {room.you.status !== "on-time" && <button type="button" className="btn" disabled={busy} onClick={() => void update({ action: "on-time" })}>{label("onTime")}</button>}
          {room.you.status !== "arrived" && <button type="button" className="btn" disabled={busy} onClick={() => void update({ action: "arrived" })}>{label("arrived")}</button>}
        </div>
        {reporting && <form className="stack" onSubmit={(event) => {
          event.preventDefault();
          const fields = new FormData(event.currentTarget);
          void update({ action: "report", eta: parseMyTime(String(fields.get("eta"))), stretch: String(fields.get("stretch")) });
        }}>
          <p className="small muted">{label("reportHint")}</p>
          <label className="field">{label("eta")}<input className="input" name="eta" type="datetime-local" defaultValue={myTimeInput(Math.max(room.you.eta ?? 0, Date.now() + 15 * 60_000))} required /></label>
          <label className="field">{label("stretch")}<input className="input" name="stretch" defaultValue={room.you.stretch} maxLength={65} placeholder="Tapah" /></label>
          <button className="btn" data-variant="primary" disabled={busy}>{label("reportSave")}</button>
        </form>}
      </Card>}
      {room.isHost && <Card id="group-host-controls" title={bm ? "Hos" : "Host controls"}>
        <button type="button" className="btn" disabled={busy} aria-expanded={changing} onClick={() => setChanging(!changing)}>{label("change")}</button>
        {changing && <form className="stack" onSubmit={(event) => {
          event.preventDefault();
          void update({ action: "reschedule", startAt: parseMyTime(String(new FormData(event.currentTarget).get("start"))) });
        }}>
          <label className="field">{label("start")}<input className="input" name="start" type="datetime-local" defaultValue={myTimeInput(room.startAt)} required /></label>
          <button className="btn" data-variant="primary" disabled={busy}>{label("publish")}</button>
        </form>}
        {invite && token.current && <button type="button" className="btn" onClick={() => void copy(invite + "#host=" + token.current, true)}>{label("copyHost")}</button>}
        <p className="small muted">{label("hostHint")}</p>
      </Card>}
      <Card title={label("guestList")} id="group-arrivals">
        <p aria-live="polite">{bm ? room.lateCount + " daripada " + room.guests.length + " dijangka lewat" : room.lateCount + " of " + room.guests.length + " expected late"}</p>
        {room.guests.length ? <ul className="list">
          {room.guests.map((guest) => <li className="banner" key={guest.id}>
            <strong>{guest.nickname}</strong> · {label(guest.status === "on-time" ? "onTime" : guest.status)}
            {guest.eta !== null && <> · {groupTime(guest.eta, lang, true)} MYT</>}{guest.stretch && <> · {guest.stretch}</>}
          </li>)}
        </ul> : <p>{label("empty")}</p>}
      </Card>
    </>}
    <p className="small muted">{label("privacy")}</p>
  </main>;
}
