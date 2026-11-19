import { createHash, randomBytes } from "node:crypto";

const minute = 60_000;
export const day = 24 * 60 * minute;
export const newCredential = () => randomBytes(16).toString("hex");
const digest = (token: string) => createHash("sha256").update(token).digest("hex");

export type GroupInput = { title: string; venue: string; startAt: number };
type PublicGuest = {
  id: string; nickname: string; status: "on-time" | "delayed" | "arrived";
  eta: number | null; stretch: string;
};
type Guest = PublicGuest & { credential: string };
export type Group = GroupInput & {
  hostDigest: string; guests: Guest[]; previousStartAt: number | null; expiresAt: number;
};
export type GroupAction =
  | { action: "join"; nickname: string }
  | { action: "report"; eta: number; stretch: string }
  | { action: "on-time" | "arrived" }
  | { action: "reschedule"; startAt: number };

export class GroupError extends Error {
  constructor(public readonly code: "forbidden" | "invalid-time" | "full") { super(code); }
}

function validStart(startAt: number, now: number) {
  if (!Number.isSafeInteger(startAt) || startAt < now - 5 * minute || startAt > now + 30 * day) {
    throw new GroupError("invalid-time");
  }
}

export function buildGroup(input: GroupInput, host: string, now: number): Group {
  validStart(input.startAt, now);
  return { ...input, hostDigest: digest(host), guests: [], previousStartAt: null, expiresAt: input.startAt + 2 * day };
}

export function applyGroupAction(group: Group, action: GroupAction, token: string, now: number): Group {
  const credential = digest(token);
  if (action.action === "reschedule") {
    if (group.hostDigest !== credential) throw new GroupError("forbidden");
    if (group.startAt === action.startAt) return group;
    validStart(action.startAt, now);
    return { ...group, previousStartAt: group.startAt, startAt: action.startAt, expiresAt: action.startAt + 2 * day };
  }

  const index = group.guests.findIndex((guest) => guest.credential === credential);
  if (action.action === "join") {
    if (index >= 0) return group;
    if (group.guests.length >= 40) throw new GroupError("full");
    return { ...group, guests: [...group.guests, {
      id: randomBytes(8).toString("hex"), credential, nickname: action.nickname, status: "on-time", eta: null, stretch: "",
    }] };
  }
  if (index < 0) throw new GroupError("forbidden");
  const guest = group.guests[index];
  if (action.action === "report" && (!Number.isSafeInteger(action.eta) || action.eta < now - 5 * minute || action.eta > group.expiresAt)) {
    throw new GroupError("invalid-time");
  }
  const details: Pick<Guest, "status" | "eta" | "stretch"> = action.action === "report"
    ? { status: "delayed", eta: action.eta, stretch: action.stretch.trim().replace(/\s+/g, " ") }
    : { status: action.action, eta: null, stretch: "" };
  const updated = group.guests.slice();
  updated[index] = { ...guest, ...details };
  return { ...group, guests: updated };
}

export function groupView(group: Group, token?: string) {
  const actor = token ? digest(token) : "";
  const guests = group.guests.map(({ credential: _credential, ...guest }) => guest);
  const self = group.guests.findIndex((guest) => guest.credential === actor);
  const lateCount = guests.filter(({ eta }) => eta !== null && eta > group.startAt).length;
  const byStretch = new Map<string, { stretch: string; count: number; earliest: number; latest: number }>();
  for (const { stretch, eta } of guests) {
    if (!stretch || eta === null) continue;
    const key = stretch.toLowerCase();
    const jam = byStretch.get(key);
    if (jam) {
      jam.count += 1;
      jam.earliest = Math.min(jam.earliest, eta);
      jam.latest = Math.max(jam.latest, eta);
    } else {
      byStretch.set(key, { stretch, count: 1, earliest: eta, latest: eta });
    }
  }

  return {
    title: group.title, venue: group.venue, startAt: group.startAt, previousStartAt: group.previousStartAt,
    guests, lateCount, jams: [...byStretch.values()].filter(({ count }) => count >= 2).sort((a, b) => b.count - a.count),
    isHost: group.hostDigest === actor, you: guests[self] ?? null,
  };
}

export type GroupView = ReturnType<typeof groupView>;
