"use client";

import { useEffect, useState } from "react";
import type { readStats } from "@/lib/counter";

type Stats = Awaited<ReturnType<typeof readStats>>;

export function StatsTable() {
  const [stats, setStats] = useState<Stats>();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    const key = new URLSearchParams(window.location.search).get("key");
    void fetch("/api/event", { signal: controller.signal, headers: { Authorization: "Bearer " + key } })
      .then((response) => {
        if (!response.ok) throw new Error("Unavailable");
        return response.json();
      })
      .then((result: Stats) => setStats(result))
      .catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, []);

  if (failed) return <p role="alert">Tester stats are temporarily unavailable.</p>;
  if (!stats) return <p role="status">Loading…</p>;
  const { rows, feedback, durable } = stats;
  return <>
    <p>{durable ? "Counts are retained across deployments." : "Counts are stored in memory and may reset on restart or cold start."}</p>
    <table className="tbl">
      <thead><tr><th scope="col">Event</th><th scope="col">Total</th><th scope="col">Approximate tabs</th></tr></thead>
      <tbody>{rows.map(({ event, count, sessions }) => <tr key={event}><th scope="row">{event}</th><td>{count}</td><td>{sessions}</td></tr>)}</tbody>
    </table>
    <h2>Anonymous feedback</h2>
    {feedback.length ? <ul className="list">{feedback.map(({ text, at }, index) => <li key={at + index}><q>{text}</q> <time>{at} UTC</time></li>)}</ul> :
      <p>No feedback yet.</p>}
  </>;
}
