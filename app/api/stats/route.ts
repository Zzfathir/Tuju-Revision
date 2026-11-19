import { NextResponse } from "next/server";
import { readStats } from "@/lib/counter";

export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const key = new URL(req.url).searchParams.get("key");
  if (!process.env.STATS_KEY || key !== process.env.STATS_KEY) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  return NextResponse.json(await readStats(), { headers: { "Cache-Control": "no-store" } });
}
