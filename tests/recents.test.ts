import { describe, expect, it } from "vitest";
import { addRecent, parseRecents } from "@/lib/recents";
import { inMalaysia } from "@/lib/bounds";
import type { Place } from "@/lib/places";

const place = (id: string, lat: number, lng: number, name = id): Place => ({ id, name, detail: "", lat, lng });

describe("addRecent", () => {
  it("puts the newest first and removes a repeat of the same spot", () => {
    const a = place("a", 3.139, 101.6869), b = place("b", 4.5975, 101.0901);
    const list = addRecent(addRecent([], a), b);
    expect(list.map((p) => p.id)).toEqual(["b", "a"]);
    const again = addRecent(list, place("a2", 3.13901, 101.68691)); // same spot to four decimals
    expect(again.map((p) => p.id)).toEqual(["a2", "b"]);
  });

  it("keeps at most six", () => {
    let list: Place[] = [];
    for (let i = 0; i < 9; i++) list = addRecent(list, place("p" + i, 3 + i * 0.1, 101));
    expect(list).toHaveLength(6);
    expect(list[0].id).toBe("p8");
  });
});

describe("parseRecents", () => {
  it("round-trips valid places", () => {
    const list = [place("a", 3.139, 101.6869, "Kuala Lumpur")];
    expect(parseRecents(JSON.stringify(list))).toEqual(list);
  });

  it("ignores junk, wrong shapes and places outside Malaysia, never throwing", () => {
    expect(parseRecents(null)).toEqual([]);
    expect(parseRecents("not json")).toEqual([]);
    expect(parseRecents('{"a":1}')).toEqual([]);
    const mixed = [place("ok", 3.139, 101.6869), { id: 1, name: "bad" }, place("london", 51.5, -0.12), null, "x"];
    expect(parseRecents(JSON.stringify(mixed)).map((p) => p.id)).toEqual(["ok"]);
  });

  it("limits what it reads back to six", () => {
    const many = Array.from({ length: 12 }, (_, i) => place("p" + i, 3 + i * 0.05, 101));
    expect(parseRecents(JSON.stringify(many))).toHaveLength(6);
  });
});

describe("inMalaysia", () => {
  it("accepts the peninsula, Sabah and Sarawak, and rejects elsewhere", () => {
    expect(inMalaysia(3.139, 101.6869)).toBe(true);
    expect(inMalaysia(5.9804, 116.0735)).toBe(true);
    expect(inMalaysia(1.3521, 103.8198)).toBe(true); // Singapore sits inside the bounding box; routing will simply find no road
    expect(inMalaysia(51.5, -0.12)).toBe(false);
    expect(inMalaysia(NaN, 101)).toBe(false);
  });
});
