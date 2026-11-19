import { describe, it, expect } from "vitest";
import fs from "node:fs";
import { matchWarnings, corridorForecast } from "@/lib/weather";
import { getRoute } from "@/lib/data";
import { googleMapsUrl, wazeLegs } from "@/lib/deeplinks";
import { windowsFor, esolatDateToIso } from "@/lib/prayer";

const g = getRoute().gazetteer;
const fx = (f: string) => JSON.parse(fs.readFileSync(`fixtures/${f}`, "utf8"));

describe("weather corridor matching", () => {
  it("drops marine and no-advisory warnings, keeps land warnings mentioning corridor states", () => {
    const w = matchWarnings(fx("weather-warning.json"), g, new Date("2026-11-20T02:00:00+08:00"));
    for (const x of w) expect(x.title_en).not.toMatch(/rough seas|no advisory/i);
  });
  it("matches by district name over state", () => {
    const fake = [{ warning_issue: { issued: "2026-11-20T10:00:00", title_en: "Thunderstorms Warning", title_bm: "Amaran Ribut Petir" }, valid_from: null, valid_to: null, text_en: "Thunderstorms over Selangor (Gombak, Hulu Selangor) and Perak (Kinta)" }];
    const [m] = matchWarnings(fake, g);
    expect(m.scope).toBe("corridor");
    expect(m.matched).toEqual(expect.arrayContaining(["Gombak", "Hulu Selangor", "Kinta"]));
  });
  it("forecast returns corridor districts ordered by km", () => {
    const f = fx("weather-forecast.json");
    const date = f[0].date;
    const out = corridorForecast(f, g, date);
    for (let i = 1; i < out.length; i++) expect(out[i].km).toBeGreaterThanOrEqual(out[i - 1].km);
  });
});

describe("deeplinks", () => {
  it("google maps url carries waypoints in order", () => {
    const u = new URL(googleMapsUrl(null, { lat: 4.6, lng: 101.09 }, [{ lat: 3.33, lng: 101.55 }, { lat: 4.17, lng: 101.29 }]));
    expect(u.searchParams.get("waypoints")).toBe("3.33,101.55|4.17,101.29");
    expect(u.searchParams.get("api")).toBe("1");
  });
  it("waze chains one leg per stop", () => {
    expect(wazeLegs({ lat: 4.6, lng: 101.09 }, [{ lat: 3.3, lng: 101.5 }])).toHaveLength(2);
  });
});

describe("prayer", () => {
  it("parses e-Solat date and builds windows", () => {
    expect(esolatDateToIso("20-Nov-2026")).toBe("2026-11-20");
    const w = windowsFor({ date: "2026-11-20", zone: "PRK02", fajr: "05:53", dhuhr: "13:04", asr: "16:26", maghrib: "19:00", isha: "20:13" });
    expect(w[0].name).toBe("Zohor");
    expect(w[0].end.getTime()).toBe(w[1].start.getTime());
  });
});
