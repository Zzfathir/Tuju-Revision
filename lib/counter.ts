import { createHash } from "node:crypto";
import { BlobPreconditionFailedError, get, put } from "@vercel/blob";

const redisUrl = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
const durable = Boolean(redisUrl && redisToken);
const bitmapSize = 4096;
type Feedback = { text: string; at: string };
type Command = (string | number)[];
export const EVENTS = ["visit", "task_done:1", "task_done:2", "task_done:3", "plan_made", "handoff_google", "handoff_waze", "share", "sim_drive"] as const;
export type EventName = (typeof EVENTS)[number];

// Counter state shared by the Blob and in-memory backends. `sessions` holds occupied sketch buckets only.
type State = { counts: Partial<Record<EventName, number>>; sessions: Partial<Record<EventName, number[]>>; feedback: Feedback[] };
const blobBacked = Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
const memory: State = { counts: {}, sessions: {}, feedback: [] };
const blobPath = "stats/counters.json";

function apply(state: State, event: EventName, bucket: number | null) {
  state.counts[event] = (state.counts[event] ?? 0) + 1;
  if (bucket === null) return;
  const used = new Set(state.sessions[event] ?? []);
  used.add(bucket);
  state.sessions[event] = [...used];
}

async function loadBlob() {
  const result = await get(blobPath, { access: "private", useCache: false, abortSignal: AbortSignal.timeout(5000) });
  if (!result?.stream) return null;
  const raw = await new Response(result.stream).json() as Partial<State>;
  const state: State = { counts: raw.counts ?? {}, sessions: raw.sessions ?? {}, feedback: raw.feedback ?? [] };
  return { state, version: result.blob.etag };
}

/** Read-modify-write with an ETag guard so concurrent testers do not overwrite each other. */
async function mutateBlob(change: (state: State) => void) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const current = await loadBlob();
    const state = current?.state ?? { counts: {}, sessions: {}, feedback: [] };
    change(state);
    try {
      await put(blobPath, JSON.stringify(state), {
        access: "private", contentType: "application/json", addRandomSuffix: false,
        allowOverwrite: Boolean(current), ifMatch: current?.version, abortSignal: AbortSignal.timeout(5000),
      });
      return;
    } catch (error) {
      // Another tester saved first (or created the file first): reload and reapply.
      if (!(error instanceof BlobPreconditionFailedError) && !/already exists/i.test(String(error))) throw error;
    }
  }
  throw new Error("Counter store busy");
}

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
  const bucket = session ? session.readUInt32BE() % bitmapSize : null;
  if (blobBacked) await mutateBlob((state) => apply(state, event, bucket));
  else apply(memory, event, bucket);
}

export async function addFeedback(text: string) {
  const clean = text.replace(/\s+/g, " ").trim().slice(0, 500);
  if (!clean) return;
  const item = { text: clean, at: new Date().toISOString().slice(0, 16) };
  if (durable) {
    await redis([["LPUSH", "feedback", JSON.stringify(item)], ["LTRIM", "feedback", 0, 199]], "multi-exec");
  } else {
    const add = (state: State) => { state.feedback = [item, ...state.feedback].slice(0, 200); };
    if (blobBacked) await mutateBlob(add);
    else add(memory);
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
  const state = blobBacked ? (await loadBlob())?.state ?? memory : memory;
  const rows = EVENTS.map((event) => {
    const count = state.counts[event] ?? 0;
    const used = new Set(state.sessions[event] ?? []).size;
    const sessions = Math.min(count, Math.round(-bitmapSize * Math.log1p(-Math.min(used, bitmapSize - 1) / bitmapSize)));
    return { event, count, sessions };
  });
  return { rows, feedback: state.feedback.slice(0, 50), durable: durable || blobBacked };
}
