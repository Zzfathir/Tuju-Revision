import { NextResponse } from "next/server";
import { z } from "zod";
import { addFeedback, EVENTS, readStats, record } from "@/lib/counter";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };
const Body = z.union([
  z.object({ event: z.enum(EVENTS), sid: z.string().max(32).optional() }),
  z.object({ feedback: z.string().trim().min(1).max(500) }),
]);

export async function GET(req: Request) {
  const key = req.headers.get("Authorization")?.replace(/^Bearer /, "") ?? new URL(req.url).searchParams.get("key");
  if (!process.env.STATS_KEY || key !== process.env.STATS_KEY) {
    return NextResponse.json({ error: "forbidden" }, { status: 403, headers });
  }
  try {
    return NextResponse.json(await readStats(), { headers });
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 503, headers });
  }
}

/** Only event type, optional tab token, and optional feedback are used. */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400, headers });
  try {
    if ("feedback" in parsed.data) await addFeedback(parsed.data.feedback);
    else await record(parsed.data.event, parsed.data.sid);
  } catch {
    return NextResponse.json({ ok: false }, { status: 503, headers });
  }
  return NextResponse.json({ ok: true }, { headers });
}
