import { NextResponse } from "next/server";
import { z } from "zod";
import { addFeedback, EVENTS, record } from "@/lib/counter";

export const dynamic = "force-dynamic";
const Body = z.union([
  z.object({ event: z.enum(EVENTS), sid: z.string().max(32).optional() }),
  z.object({ feedback: z.string().min(1).max(500) }),
]);

/** Anonymous: we deliberately ignore IP, headers and cookies. */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });
  try {
    if ("feedback" in parsed.data) await addFeedback(parsed.data.feedback);
    else await record(parsed.data.event, parsed.data.sid);
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
