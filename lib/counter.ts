import { createHash } from "node:crypto";

const redisUrl = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
const durable = Boolean(redisUrl && redisToken);
const bitmapSize = 4096;
type Feedback = { text: string; at: string };
type Command = (string | number)[];
export const EVENTS = ["visit", "task_done:1", "task_done:2", "task_done:3", "plan_made", "handoff_google", "handoff_waze", "share", "sim_drive"] as const;
export type EventName = (typeof EVENTS)[number];

const memory = {
  counts: new Map<EventName, number>(),
  sessions: new Map<EventName, Uint8Array>(),
  feedback: [] as Feedback[],
};

async function redis(commands: Command[], mode: "multi-exec" | "pipeline") {
  const response = await fetch(new URL("/" + mode, redisUrl), {
    method: "POST",
    headers: { Authorization: "Bearer " + redisToken, "Content-Type": "application/json" },
    body: JSON.stringify(commands), cache: "no-store", signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error("Counter backend error: " + response.status);
  const data: { error?: string; result?: unknown }[] = await response.json();
  if (data.some((entry) => entry.error)) throw new Error("Counter command failed");
  return data.map((entry) => entry.result);
}

export async function record(event: EventName, sid?: string) {
  // A random browser tab token is folded into an aggregate sketch. It is not stored.
  const session = sid && /^[a-z0-9]{8,32}$/i.test(sid)
    ? createHash("sha256").update(event + ":" + sid).digest()
    : null;
  if (durable) {
    const commands: Command[] = [["INCR", "c:" + event]];
    if (session) commands.push(["PFADD", "u:" + event, session.toString("hex")]);
    await redis(commands, "multi-exec");
    return;
  }
  memory.counts.set(event, (memory.counts.get(event) ?? 0) + 1);
  if (session) {
    const bitmap = memory.sessions.get(event) ?? new Uint8Array(bitmapSize);
    bitmap[session.readUInt32BE() % bitmapSize] = 1;
    memory.sessions.set(event, bitmap);
  }
}

export async function addFeedback(text: string) {
  const clean = text.replace(/\s+/g, " ").trim().slice(0, 500);
  if (!clean) return;
  const item = { text: clean, at: new Date().toISOString().slice(0, 16) };
  if (durable) {
    await redis([["LPUSH", "feedback", JSON.stringify(item)], ["LTRIM", "feedback", 0, 199]], "multi-exec");
  } else {
    memory.feedback.unshift(item);
    memory.feedback.length = Math.min(memory.feedback.length, 200);
  }
}

export async function readStats() {
  if (durable) {
    const commands: Command[] = EVENTS.flatMap((event) => [["GET", "c:" + event], ["PFCOUNT", "u:" + event]]);
    const result = await redis([...commands, ["LRANGE", "feedback", 0, 49]], "pipeline");
    const rows = EVENTS.map((event, index) => ({
      event, count: Number(result[2 * index] ?? 0), sessions: Number(result[2 * index + 1] ?? 0),
    }));
    const feedback = ((result.at(-1) ?? []) as string[]).map((item) => JSON.parse(item) as Feedback);
    return { rows, feedback, durable };
  }
  const rows = EVENTS.map((event) => {
    const count = memory.counts.get(event) ?? 0;
    const used = memory.sessions.get(event)?.reduce((total, bit) => total + bit, 0) ?? 0;
    const sessions = Math.min(count, Math.round(-bitmapSize * Math.log1p(-used / bitmapSize)));
    return { event, count, sessions };
  });
  return { rows, feedback: memory.feedback.slice(0, 50), durable };
}
