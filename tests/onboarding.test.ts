import { describe, expect, it } from "vitest";
import { parsePrefs, prefsQuery } from "@/lib/onboarding";

describe("parsePrefs", () => {
  it("defaults to English, petrol, no needs", () => {
    expect(parsePrefs({})).toEqual({ lang: "en", vehicle: "petrol", needs: [] });
  });
  it("reads lang, vehicle and comma-separated needs", () => {
    expect(parsePrefs({ lang: "bm", vehicle: "ev", needs: "toilet,surau" }))
      .toEqual({ lang: "bm", vehicle: "ev", needs: ["toilet", "surau"] });
  });
  it("falls back on invalid values and drops unknown needs", () => {
    expect(parsePrefs({ vehicle: "banana", lang: "fr", needs: "toilet,nope,,ev" }))
      .toEqual({ lang: "en", vehicle: "petrol", needs: ["toilet", "ev"] });
  });
  it("accepts repeated needs parameters", () => {
    expect(parsePrefs({ needs: ["toilet", "food"] }).needs).toEqual(["toilet", "food"]);
  });
});

describe("prefsQuery", () => {
  it("is empty for defaults", () => {
    expect(prefsQuery({ lang: "en", vehicle: "petrol", needs: [] })).toBe("");
  });
  it("round-trips non-default prefs and keeps extras", () => {
    const query = prefsQuery({ lang: "bm", vehicle: "ev", needs: ["toilet", "surau"] }, { t: "1" });
    const params = Object.fromEntries(new URLSearchParams(query.slice(1)));
    expect(params.t).toBe("1");
    expect(parsePrefs(params)).toEqual({ lang: "bm", vehicle: "ev", needs: ["toilet", "surau"] });
  });
});
