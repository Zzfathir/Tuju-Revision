import { describe, it, expect } from "vitest";
import fs from "node:fs";
import { MetWarnings, MetForecasts, ESolat, RnrFile, TollFile, Stop } from "@/lib/schemas";

const fx = (f: string) => JSON.parse(fs.readFileSync(`fixtures/${f}`, "utf8"));

describe("external payload schemas (against real saved fixtures)", () => {
  it("MET warnings fixture parses", () => expect(MetWarnings.safeParse(fx("weather-warning.json")).success).toBe(true));
  it("MET forecast fixture parses", () => expect(MetForecasts.safeParse(fx("weather-forecast.json")).success).toBe(true));
  it("e-Solat fixture parses", () => expect(ESolat.safeParse(fx("esolat-month-PRK02.json")).success).toBe(true));
  it("rejects garbage", () => {
    expect(MetWarnings.safeParse({ hello: 1 }).success).toBe(false);
    expect(ESolat.safeParse({ status: "OK", zone: "X", prayerTime: [] }).success).toBe(false);
  });
});

describe("data files carry provenance", () => {
  it("rnr.json valid, every stop has source_url/retrieved_at/verified", () => {
    const d = RnrFile.parse(JSON.parse(fs.readFileSync("data/routes/kl-ipoh/rnr.json", "utf8")));
    expect(d.items.length).toBeGreaterThan(0);
    for (const s of d.items) {
      expect(s.source_url).toMatch(/^https:/);
      expect(typeof s.verified).toBe("boolean");
    }
  });
  it("tolls.json valid; unverified file contains no numeric fares claimed as verified", () => {
    const t = TollFile.parse(JSON.parse(fs.readFileSync("data/routes/kl-ipoh/tolls.json", "utf8")));
    if (!t.verified) expect(t.note).toMatch(/NOT yet verified|verify/i);
  });
  it("facility unknown must be null, not false", () => {
    const bad = { ...JSON.parse(fs.readFileSync("data/routes/kl-ipoh/rnr.json", "utf8")).items[0] };
    expect(Stop.safeParse({ ...bad, facilities: { ...bad.facilities, surau: "maybe" } }).success).toBe(false);
  });
});
