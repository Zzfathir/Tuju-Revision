import { describe, expect, it } from "vitest";
import { buildGroup, applyGroupAction, groupView } from "@/lib/group-arrival";

const now = Date.UTC(2026, 10, 20, 10);
const startAt = now + 3600_000;
const minute = 60_000;
const host = "a".repeat(32);
const guests = ["b", "c", "d"].map((char) => char.repeat(32));
const event = () => buildGroup({ title: "Dinner", venue: "Ipoh", startAt }, host, now);

describe("Group Arrival", () => {
  it("groups active reports for the same road stretch and counts guests due after the published start", () => {
    let group = event();
    for (const [index, guest] of guests.entries()) {
      group = applyGroupAction(group, { action: "join", nickname: "Guest " + index }, guest, now);
    }
    group = applyGroupAction(group, { action: "report", eta: startAt + 15 * minute, stretch: " near   Tapah " }, guests[0], now);
    group = applyGroupAction(group, { action: "report", eta: startAt + 25 * minute, stretch: "Near tapah" }, guests[1], now);
    group = applyGroupAction(group, { action: "report", eta: startAt + 30 * minute, stretch: "" }, guests[2], now);

    const view = groupView(group, guests[0]);
    expect(view).toMatchObject({
      isHost: false,
      lateCount: 3,
      jams: [{ stretch: "near Tapah", count: 2, earliest: startAt + 15 * minute, latest: startAt + 25 * minute }],
    });
    expect(view.guests).toHaveLength(3);
    expect(JSON.stringify(view)).not.toContain(group.hostDigest);
    expect(JSON.stringify(view)).not.toContain(group.guests[0].credential);
  });

  it("keeps one guest on join retry and clears their report when they arrive", () => {
    const group = applyGroupAction(event(), { action: "join", nickname: "Rae" }, guests[0], now);
    expect(applyGroupAction(group, { action: "join", nickname: "Rae" }, guests[0], now)).toBe(group);
    const delayed = applyGroupAction(group, { action: "report", eta: startAt + minute, stretch: "Tapah" }, guests[0], now);
    const arrived = applyGroupAction(delayed, { action: "arrived" }, guests[0], now);
    expect(groupView(arrived, guests[0])).toMatchObject({ lateCount: 0, jams: [], you: { status: "arrived", eta: null, stretch: "" } });
  });

  it("lets only the host publish a new start and recalculates lateness", () => {
    const group = applyGroupAction(event(), { action: "join", nickname: "Rae" }, guests[0], now);
    const delayed = applyGroupAction(group, { action: "report", eta: startAt + minute, stretch: "" }, guests[0], now);
    const change = { action: "reschedule" as const, startAt: startAt + 5 * minute };
    expect(() => applyGroupAction(delayed, change, guests[0], now)).toThrow("forbidden");
    const updated = applyGroupAction(delayed, change, host, now);
    expect(groupView(updated, host)).toMatchObject({ isHost: true, startAt: change.startAt, lateCount: 0 });
  });

  it("rejects reports from people who have not joined and invalid arrival times", () => {
    const action = { action: "report" as const, eta: now - 60 * minute, stretch: "" };
    expect(() => applyGroupAction(event(), action, guests[0], now)).toThrow("forbidden");
    const member = applyGroupAction(event(), { action: "join", nickname: "Rae" }, guests[0], now);
    expect(() => applyGroupAction(member, action, guests[0], now)).toThrow("invalid-time");
  });
});
