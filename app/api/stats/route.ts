import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export function GET(req: Request) {
  const url = new URL(req.url);
  if (!process.env.STATS_KEY || url.searchParams.get("key") !== process.env.STATS_KEY) {
    return NextResponse.json({ error: "forbidden" }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }
  url.pathname = "/api/event";
  return NextResponse.redirect(url, { headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
}
