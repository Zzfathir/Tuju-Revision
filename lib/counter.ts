/**
 * Anonymous aggregate counters. Stores ONLY integers per event name, plus
 * a set-cardinality of random per-tab ids (generated client-side, kept in sessionStorage),
 * plus free-text feedback with no identifiers. No IPs, no cookies, no user agents.
 *
 * Backend: Upstash Redis REST if UPSTASH_REDIS_REST_URL/TOKEN are set (durable across
 * serverless instances); otherwise in-memory (resets on cold start — /stats says so).
 */
const URL_ = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
export const durable = Boolean(URL_ && TOKEN);

const mem = { counts: new Map<string, number>(), sessions: new Map<string, Set<string>>(), feedback: [] as { text: string; at: string }[] };

async function redis(cmd: (string | number)[]) {
  const r = await fetch(URL_!, { method: "POST", headers: { Authorization: `Bearer ${TOKEN}` }, body: JSON.stringify(cmd), cache: "no-store" });
  if (!r.ok) throw new Error(`redis ${r.status}`);
  return (await r.json()).result;
}

export const EVENTS = ["visit", "task_done:1", "task_done:2", "task_done:3", "plan_made", "handoff_google", "handoff_waze", "share", "sim_drive"] as const;
export type EventName = (typeof EVENTS)[number];

export async function record(ev: EventName, sid?: string) {
  const s = sid && /^[a-z0-9]{8,32}$/i.test(sid) ? sid : undefined;
  if (durable) {
    await redis(["INCR", `c:${ev}`]);
    if (s) await redis(["PFADD", `u:${ev}`, s]);
    return;
  }
  mem.counts.set(ev, (mem.counts.get(ev) ?? 0) + 1);
  if (s) { if (!mem.sessions.has(ev)) mem.sessions.set(ev, new Set()); mem.sessions.get(ev)!.add(s); }
}

export async function addFeedback(text: string) {
  const clean = text.replace(/\s+/g, " ").trim().slice(0, 500);
  if (!clean) return;
  const item = { text: clean, at: new Date().toISOString().slice(0, 16) };
  if (durable) await redis(["LPUSH", "feedback", JSON.stringify(item)]), await redis(["LTRIM", "feedback", 0, 199]);
  else mem.feedback.unshift(item), (mem.feedback.length = Math.min(mem.feedback.length, 200));
}

export async function readStats() {
  const rows: { event: string; count: number; sessions: number }[] = [];
  for (const ev of EVENTS) {
    if (durable) {
      const [c, u] = await Promise.all([redis(["GET", `c:${ev}`]), redis(["PFCOUNT", `u:${ev}`])]);
      rows.push({ event: ev, count: Number(c ?? 0), sessions: Number(u ?? 0) });
    } else rows.push({ event: ev, count: mem.counts.get(ev) ?? 0, sessions: mem.sessions.get(ev)?.size ?? 0 });
  }
  const feedback = durable ? ((await redis(["LRANGE", "feedback", 0, 49])) as string[]).map((s) => JSON.parse(s)) : mem.feedback.slice(0, 50);
  return { rows, feedback, durable };
}
