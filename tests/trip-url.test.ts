import { describe, expect, it } from "vitest";
import { parseTripParams, tripParams } from "@/lib/trip-url";
import type { Place } from "@/lib/places";

const defaults = {
  from: { id: "default-from", name: "Kuala Lumpur (Jalan Duta)", detail: "", lat: 3.1757, lng: 101.6558 } as Place,
  to: { id: "default-to", name: "Ipoh", detail: "", lat: 4.5975, lng: 101.0901 } as Place,
};

describe("parseTripParams", () => {
  it("falls back to the defaults when nothing valid is given", () => {
    expect(parseTripParams({}, defaults)).toEqual(defaults);
    expect(parseTripParams({ from: "abc", to: "51.5,-0.1" }, defaults)).toEqual(defaults);
  });

  it("reads coordinates and names, rounding to four decimals", () => {
    const { from, to } = parseTripParams({ from: "5.4141,100.3288", fromName: "George Town", to: "1.49271234,103.74141234", toName: "Johor Bahru" }, defaults);
    expect(from).toMatchObject({ name: "George Town", lat: 5.4141, lng: 100.3288 });
    expect(to).toMatchObject({ name: "Johor Bahru", lat: 1.4927, lng: 103.7414 });
  });

  it("keeps a valid field when the other is bad, names missing places plainly and clips long names", () => {
    const { from, to } = parseTripParams({ from: "5.4141,100.3288", to: "nonsense", toName: "x".repeat(200) }, defaults);
    expect(from.name).toBe("Selected place");
    expect(to).toEqual(defaults.to);
    const long = parseTripParams({ from: "5.4,100.3", fromName: "y".repeat(200) }, defaults).from.name;
    expect(long.length).toBeLessThanOrEqual(60);
  });

  it("accepts repeated parameters without crashing", () => {
    expect(parseTripParams({ from: ["5.4141,100.3288", "1,1"], fromName: ["A", "B"] }, defaults).from).toMatchObject({ name: "A", lat: 5.4141 });
  });
});

describe("tripParams", () => {
  it("is empty for the default trip and complete for any other", () => {
    expect(tripParams(defaults.from, defaults.to, defaults)).toEqual({});
    const other = { id: "x", name: "Taiping", detail: "Perak", lat: 4.85, lng: 100.7333 } as Place;
    expect(tripParams(defaults.from, other, defaults)).toEqual({ from: "3.1757,101.6558", fromName: "Kuala Lumpur (Jalan Duta)", to: "4.85,100.7333", toName: "Taiping" });
  });

  it("round-trips through parseTripParams", () => {
    const other = { id: "x", name: "Taiping", detail: "", lat: 4.85, lng: 100.7333 } as Place;
    const back = parseTripParams(tripParams(other, defaults.from, defaults), defaults);
    expect(back.from).toMatchObject({ name: "Taiping", lat: 4.85, lng: 100.7333 });
    expect(back.to).toMatchObject({ lat: 3.1757, lng: 101.6558 });
  });
});
