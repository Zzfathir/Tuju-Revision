import { describe, expect, it } from "vitest";
import {
  applyFacilityRows, applyTollRows, buildFacilitiesTemplate, buildTollTemplate, parseCsv,
} from "@/lib/entry-import";
import type { RnrFile, TollFile } from "@/lib/schemas";

const tolls = (): TollFile => ({
  source_url: "https://www.plus.com.my/#toll-fare-calculator", retrieved_at: "2026-11-20", verified: true, routeId: "t",
  vehicleClass: "Class 1 (private car)", currency: "MYR", note: "n",
  plazas: [
    { id: "A", name: "Plaza A", lat: 0, lng: 0, distanceAlongRoute_km: 0, type: "closed-entry-exit" },
    { id: "B", name: "Plaza B", lat: 0, lng: 0, distanceAlongRoute_km: 10, type: "closed-entry-exit" },
    { id: "C", name: "Plaza C", lat: 0, lng: 0, distanceAlongRoute_km: 20, type: "closed-entry-exit" },
  ],
  fares: { A: { B: 1.5, C: null }, B: { C: null } },
});
const rnr = (): RnrFile => ({
  source_url: "https://example.org", retrieved_at: "2026-11-19", verified: false, routeId: "t", source: "OSM",
  items: [
    { id: "s1", name: "Stop One", kind: "rnr", direction: "north", lat: 0, lng: 0, distanceAlongRoute_km: 5, verified: false, source_url: "https://example.org", retrieved_at: "2026-11-19",
      facilities: { surau: null, toilet: true, fuel: null, evCharger: null, food: null, atm: null } },
    { id: "s2", name: "Stop Two", kind: "rnr", direction: "north", lat: 0, lng: 0, distanceAlongRoute_km: 15, verified: true, source_url: "https://example.org", retrieved_at: "2026-11-19",
      facilities: { surau: true, toilet: true, fuel: false, evCharger: null, food: null, atm: null } },
  ],
});
const SRC = "https://www.plus.com.my/our-facilities/";

describe("parseCsv", () => {
  it("handles quotes, commas inside quotes, CRLF and blank lines", () => {
    const rows = parseCsv('a,b,c\r\n1,"two, with comma","say ""hi"""\r\n\r\n4,5,6\r\n');
    expect(rows).toEqual([{ a: "1", b: "two, with comma", c: 'say "hi"' }, { a: "4", b: "5", c: "6" }]);
  });
});

describe("applyTollRows", () => {
  it("applies a checked fare and ignores blank fares", () => {
    const rows = parseCsv(`entry_id,exit_id,fare_rm,source_url,checked_on\nA,C,3.20,${SRC},2026-11-21\nB,C,,,\n`);
    const { file, applied, errors } = applyTollRows(tolls(), rows);
    expect(errors).toEqual([]);
    expect(applied).toBe(1);
    expect(file.fares.A.C).toBe(3.2);
    expect(file.fares.B.C).toBeNull(); // blank never becomes a number or zero
  });

  it("rejects a fare without a source and date", () => {
    const { applied, errors, file } = applyTollRows(tolls(), parseCsv("entry_id,exit_id,fare_rm,source_url,checked_on\nA,C,3.20,,\n"));
    expect(applied).toBe(0);
    expect(errors[0]).toMatch(/source/i);
    expect(file.fares.A.C).toBeNull();
  });

  it("rejects unknown plazas, wrong direction and nonsense fares, applying nothing from bad rows", () => {
    const csv = `entry_id,exit_id,fare_rm,source_url,checked_on\nZ,C,1,${SRC},2026-11-21\nC,A,1,${SRC},2026-11-21\nA,B,-4,${SRC},2026-11-21\nA,C,abc,${SRC},2026-11-21\n`;
    const { applied, errors, file } = applyTollRows(tolls(), parseCsv(csv));
    expect(applied).toBe(0);
    expect(errors).toHaveLength(4);
    expect(file.fares.A.B).toBe(1.5);
  });

  it("does not mutate the input file", () => {
    const original = tolls();
    applyTollRows(original, parseCsv(`entry_id,exit_id,fare_rm,source_url,checked_on\nA,C,3.2,${SRC},2026-11-21\n`));
    expect(original.fares.A.C).toBeNull();
  });
});

describe("applyFacilityRows", () => {
  const head = "stop_id,surau,toilet,fuel,ev_charger,food,atm,source_url,checked_on\n";
  it("sets yes and no, leaves blanks unknown, and records provenance", () => {
    const { file, applied, errors } = applyFacilityRows(rnr(), parseCsv(`${head}s1,yes,,no,yes,,,${SRC},2026-11-21\n`));
    expect(errors).toEqual([]);
    expect(applied).toBe(1);
    const s1 = file.items[0];
    expect(s1.facilities).toEqual({ surau: true, toilet: true, fuel: false, evCharger: true, food: null, atm: null });
    expect(s1.verified).toBe(true);
    expect(s1.source_url).toBe(SRC);
    expect(s1.retrieved_at).toBe("2026-11-21");
  });

  it("rejects anything other than yes / no / blank, and a missing source", () => {
    const { applied, errors } = applyFacilityRows(rnr(), parseCsv(`${head}s1,maybe,,,,,,${SRC},2026-11-21\ns2,yes,,,,,,,\nnope,yes,,,,,,${SRC},2026-11-21\n`));
    expect(applied).toBe(0);
    expect(errors).toHaveLength(3);
  });
});

describe("templates", () => {
  it("toll template lists every forward pair and round-trips without errors", () => {
    const text = buildTollTemplate(tolls());
    const rows = parseCsv(text);
    expect(rows.map((r) => r.entry_id + ">" + r.exit_id)).toEqual(["A>B", "A>C", "B>C"]);
    const known = rows.find((r) => r.entry_id === "A" && r.exit_id === "B")!;
    expect(known.fare_rm).toBe("1.5");
    expect(applyTollRows(tolls(), rows).errors).toEqual([]);
  });

  it("facility template keeps unverified OSM guesses out of the editable columns", () => {
    const rows = parseCsv(buildFacilitiesTemplate(rnr()));
    const s1 = rows.find((r) => r.stop_id === "s1")!;
    const s2 = rows.find((r) => r.stop_id === "s2")!;
    expect(s1.toilet).toBe(""); // OSM-only, unverified: hint only
    expect(s1.osm_hint).toMatch(/toilet/);
    expect(s2.surau).toBe("yes"); // already hand-checked
    expect(s2.fuel).toBe("no");
    expect(applyFacilityRows(rnr(), rows).errors).toEqual([]);
  });
});

describe("hardening", () => {
  const facilityHead = "stop_id,surau,toilet,fuel,ev_charger,food,atm,source_url,checked_on\n";

  it("parseCsv: a quote inside an unquoted field is literal, and an unterminated quote is an error", () => {
    expect(parseCsv('a\nx"y\n')).toEqual([{ a: 'x"y' }]);
    expect(() => parseCsv('a,b\n1,"oops')).toThrow(/quote/i);
  });

  it("templates: cells that spreadsheets would run as formulas are neutralised", () => {
    const evil = rnr();
    evil.items[0].name = '=HYPERLINK("https://evil.example","click")';
    evil.items[1].name = "+1+1";
    const text = buildFacilitiesTemplate(evil);
    expect(text).not.toMatch(/(^|,)"?=HYPERLINK/m);
    expect(text).toContain("'=HYPERLINK");
    expect(text).toContain("'+1+1");
    const rows = parseCsv(text);
    expect(rows.map((r) => r.stop_id)).toEqual(["s1", "s2"]); // ids still round-trip
  });

  it("source_url must be https and carry no credentials", () => {
    const base = `${facilityHead}s1,yes,,,,,,`;
    for (const bad of ["http://example.org/x", "javascript:alert(1)", "https://user:pw@example.org/", "ftp://example.org", "not a url"]) {
      const { applied, errors } = applyFacilityRows(rnr(), parseCsv(`${base}${bad},2026-11-21\n`));
      expect(applied, bad).toBe(0);
      expect(errors, bad).toHaveLength(1);
    }
  });

  it("facilities: reports the validated entries, taken from the row that was actually applied", () => {
    const csv = `${facilityHead}s1,maybe,,,,,,${SRC},2026-11-21\ns1,yes,,no,,,,${SRC},2026-11-22\n`;
    const { applied, errors, entries } = applyFacilityRows(rnr(), parseCsv(csv));
    expect(applied).toBe(1);
    expect(errors).toHaveLength(1);
    expect(entries).toEqual([{ stopId: "s1", facilities: { surau: true, fuel: false }, source_url: SRC, checked_on: "2026-11-22" }]);
  });
});

describe("re-applying identical values", () => {
  const facilityHead = "stop_id,surau,toilet,fuel,ev_charger,food,atm,source_url,checked_on\n";

  it("tolls: a no-op counts nothing and leaves the provenance note and date alone", () => {
    const same = parseCsv(`entry_id,exit_id,fare_rm,source_url,checked_on\nA,B,1.5,${SRC},2026-11-21\n`);
    const result = applyTollRows(tolls(), same);
    expect(result.errors).toEqual([]);
    expect(result.applied).toBe(0);
    expect(result.file.note).toBe(tolls().note);
    expect(result.file.retrieved_at).toBe("2026-11-20");
  });

  it("facilities: applying the same row twice only counts once", () => {
    const row = parseCsv(`${facilityHead}s1,yes,,,,,,${SRC},2026-11-21\n`);
    const once = applyFacilityRows(rnr(), row);
    expect(once.applied).toBe(1);
    expect(applyFacilityRows(once.file, row).applied).toBe(0);
  });
});
