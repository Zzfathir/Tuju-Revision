import { describe, expect, it } from "vitest";
import { createIntent } from "@/lib/cruise/intent";
import { cruiseConfig } from "@/lib/cruise/config";
import type { Snapped } from "@/lib/cruise/pipeline";

const snap = (over: Partial<Snapped> = {}): Snapped => ({
  t: 0, lat: 0, lng: 0, speed: 25, heading: 0, km: 50, offM: 10, routeBearing: 0, remainingKm: 100, ...over,
});
/** Feed `count` fixes one second apart and return the events produced (null for no event). */
const feed = (intent: ReturnType<typeof createIntent>, state: Parameters<ReturnType<typeof createIntent>["step"]>[0], count: number, over: Partial<Snapped>, start = 0) =>
  Array.from({ length: count }, (_, i) => intent.step(state, snap({ ...over, t: start + i * 1000 })));

describe("entering CRUISING from ARMED", () => {
  it("needs five consecutive good fixes, and no event before that", () => {
    const events = feed(createIntent(cruiseConfig), "ARMED", 5, {});
    expect(events).toEqual([null, null, null, null, "ON_ROUTE"]);
  });

  it("one bad fix resets the count", () => {
    const intent = createIntent(cruiseConfig);
    feed(intent, "ARMED", 4, {});
    expect(intent.step("ARMED", snap({ offM: 80 }))).toBeNull();
    expect(feed(intent, "ARMED", 4, {})).toEqual([null, null, null, null]); // started again from zero
    expect(intent.step("ARMED", snap())).toBe("ON_ROUTE");
  });

  it("a fix 60 m or more from the route is not a good fix", () => {
    expect(feed(createIntent(cruiseConfig), "ARMED", 8, { offM: 60 }).every((e) => e === null)).toBe(true);
    expect(feed(createIntent(cruiseConfig), "ARMED", 5, { offM: 59 }).at(-1)).toBe("ON_ROUTE");
  });

  it("heading more than 30 degrees from the route blocks entry (the other carriageway)", () => {
    const events = feed(createIntent(cruiseConfig), "ARMED", 10, { heading: 180, routeBearing: 0 });
    expect(events.every((e) => e === null)).toBe(true);
    expect(feed(createIntent(cruiseConfig), "ARMED", 5, { heading: 29, routeBearing: 0 }).at(-1)).toBe("ON_ROUTE");
    expect(feed(createIntent(cruiseConfig), "ARMED", 5, { heading: 340, routeBearing: 5 }).at(-1)).toBe("ON_ROUTE"); // wraps around north
  });

  it("ignores the heading check below 2 m/s, when GPS heading is meaningless", () => {
    expect(feed(createIntent(cruiseConfig), "ARMED", 5, { speed: 1, heading: 180, routeBearing: 0 }).at(-1)).toBe("ON_ROUTE");
  });
});

describe("going OFF_ROUTE from CRUISING", () => {
  it("needs both distance over 120 m and at least 10 seconds", () => {
    const intent = createIntent(cruiseConfig);
    const events = feed(intent, "CRUISING", 12, { offM: 200 });
    expect(events.slice(0, 10)).toEqual(Array(10).fill(null)); // t = 0 to 9 s
    expect(events[10]).toBe("OFF"); // t = 10 s
  });

  it("distance alone is not enough: a brief excursion does nothing", () => {
    const intent = createIntent(cruiseConfig);
    feed(intent, "CRUISING", 8, { offM: 300 });
    feed(intent, "CRUISING", 1, { offM: 20 }, 8000); // back on the route: the timer resets
    expect(feed(intent, "CRUISING", 9, { offM: 300 }, 9000).every((e) => e === null)).toBe(true);
  });

  it("time alone is not enough: staying 100 m off for a long time is not off-route", () => {
    expect(feed(createIntent(cruiseConfig), "CRUISING", 60, { offM: 100 }).every((e) => e === null)).toBe(true);
  });

  it("exactly 120 m is not over the limit", () => {
    expect(feed(createIntent(cruiseConfig), "CRUISING", 30, { offM: 120 }).every((e) => e === null)).toBe(true);
  });
});

describe("recovering from OFF_ROUTE", () => {
  it("needs three consecutive fixes under 60 m", () => {
    expect(feed(createIntent(cruiseConfig), "OFF_ROUTE", 3, { offM: 30 })).toEqual([null, null, "ON_ROUTE"]);
  });

  it("a fix that is still too far resets the count", () => {
    const intent = createIntent(cruiseConfig);
    feed(intent, "OFF_ROUTE", 2, { offM: 30 });
    expect(intent.step("OFF_ROUTE", snap({ offM: 90 }))).toBeNull();
    expect(feed(intent, "OFF_ROUTE", 3, { offM: 30 }).at(-1)).toBe("ON_ROUTE");
    const again = createIntent(cruiseConfig);
    feed(again, "OFF_ROUTE", 2, { offM: 30 });
    again.step("OFF_ROUTE", snap({ offM: 90 }));
    expect(feed(again, "OFF_ROUTE", 2, { offM: 30 })).toEqual([null, null]);
  });
});

describe("arriving", () => {
  it("fires NEAR_END once less than 2 km of route remains, and takes priority over off-route", () => {
    const intent = createIntent(cruiseConfig);
    expect(intent.step("CRUISING", snap({ remainingKm: 2.01 }))).toBeNull();
    expect(intent.step("CRUISING", snap({ remainingKm: 1.99 }))).toBe("NEAR_END");
    expect(createIntent(cruiseConfig).step("CRUISING", snap({ remainingKm: 1, offM: 500 }))).toBe("NEAR_END");
  });
});

describe("states that produce no events", () => {
  it("IDLE, ARRIVING and ENDED never generate intent (the user ends the drive)", () => {
    for (const state of ["IDLE", "ARRIVING", "ENDED"] as const) {
      expect(feed(createIntent(cruiseConfig), state, 20, { offM: 500 }).every((e) => e === null)).toBe(true);
    }
  });

  it("counters do not leak between states", () => {
    const intent = createIntent(cruiseConfig);
    feed(intent, "ARMED", 4, {}); // four good fixes in ARMED
    feed(intent, "CRUISING", 1, {}); // state changed
    expect(intent.step("ARMED", snap())).toBeNull(); // the count restarted, so this is only the first good fix
  });
});
