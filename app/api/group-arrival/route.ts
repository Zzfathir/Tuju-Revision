import { z } from "zod";
import { applyGroupAction, buildGroup, GroupError, groupView, newCredential } from "@/lib/group-arrival";
import { groupStore } from "@/lib/group-store";

export const dynamic = "force-dynamic";

const key = z.string().regex(/^[a-f0-9]{32}$/);
const timestamp = z.number().int().safe();
const change = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create"), title: z.string().trim().min(1).max(70), venue: z.string().trim().min(1).max(120), startAt: timestamp }),
  z.object({ action: z.literal("join"), id: key, nickname: z.string().trim().min(1).max(30) }),
  z.object({ action: z.literal("report"), id: key, eta: timestamp, stretch: z.string().trim().max(65) }),
  z.object({ action: z.literal("on-time"), id: key }),
  z.object({ action: z.literal("arrived"), id: key }),
  z.object({ action: z.literal("reschedule"), id: key, startAt: timestamp }),
]);
const headers = { "Cache-Control": "private, no-store" };

function failure(error: string, status: number) {
  return Response.json({ error }, { status, headers });
}

function tokenFor(request: Request) {
  const value = request.headers.get("Authorization")?.replace(/^Bearer /, "");
  return key.safeParse(value).data;
}

export async function GET(request: Request) {
  const id = key.safeParse(new URL(request.url).searchParams.get("id"));
  if (!id.success) return failure("missing", 404);
  try {
    const current = await groupStore().read(id.data);
    if (!current || current.group.expiresAt <= Date.now()) return failure("missing", 404);
    return Response.json(groupView(current.group, tokenFor(request)), { headers });
  } catch {
    return failure("unavailable", 503);
  }
}

export async function POST(request: Request) {
  const parsed = change.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return failure("invalid", 400);
  const action = parsed.data;
  try {
    const store = groupStore();
    if (action.action === "create") {
      const id = newCredential();
      const host = newCredential();
      const group = buildGroup({ title: action.title, venue: action.venue, startAt: action.startAt }, host, Date.now());
      if (!await store.write(id, group)) return failure("busy", 409);
      return Response.json({ id, host }, { status: 201, headers });
    }

    const token = tokenFor(request);
    if (!token) return failure("forbidden", 403);
    for (let attempt = 0; attempt < 4; attempt++) {
      const current = await store.read(action.id);
      const now = Date.now();
      if (!current || current.group.expiresAt <= now) return failure("missing", 404);
      const updated = applyGroupAction(current.group, action, token, now);
      // Reapply the same action to the latest version if another attendee saved first.
      if (updated === current.group || await store.write(action.id, updated, current.version)) {
        return Response.json(groupView(updated, token), { headers });
      }
    }
    return failure("busy", 409);
  } catch (error) {
    if (error instanceof GroupError) {
      return failure(error.code, error.code === "forbidden" ? 403 : error.code === "full" ? 409 : 400);
    }
    return failure("unavailable", 503);
  }
}
