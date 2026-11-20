import { describe, expect, it } from "vitest";
import { parseSaved, toggleSaved } from "@/lib/saved-places";

describe("saved places", () => {
  it("reads only unique string ids and survives broken storage", () => {
    expect(parseSaved('["a","a",3,"b"]')).toEqual(["a", "b"]);
    expect(parseSaved("not json")).toEqual([]);
    expect(parseSaved(null)).toEqual([]);
  });

  it("toggles a place on and off", () => {
    expect(toggleSaved(["a"], "b")).toEqual(["a", "b"]);
    expect(toggleSaved(["a", "b"], "a")).toEqual(["b"]);
  });
});
