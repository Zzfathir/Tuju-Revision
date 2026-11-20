/**
 * Hand-checked data entry for tolls and R&R facilities (no scraping).
 *   npx tsx scripts/import-entry.ts templates [routeId]   write blank/prefilled CSV sheets to data/entry/
 *   npx tsx scripts/import-entry.ts tolls [routeId]       import data/entry/tolls-<routeId>.csv
 *   npx tsx scripts/import-entry.ts facilities [routeId]  import data/entry/facilities-<routeId>.csv
 * Rows that fail validation are reported and skipped; valid rows are applied. Blank cells never change anything.
 */
import fs from "node:fs";
import path from "node:path";
import { applyFacilityRows, applyTollRows, buildFacilitiesTemplate, buildTollTemplate, parseCsv } from "../lib/entry-import";
import type { RnrFile, TollFile } from "../lib/schemas";

const [mode, routeId = "kl-ipoh"] = process.argv.slice(2);
const dir = path.join("data/routes", routeId);
const entryDir = "data/entry";
const read = <T>(file: string) => JSON.parse(fs.readFileSync(file, "utf8")) as T;
const write = (file: string, value: unknown) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n");
const tollsPath = path.join(dir, "tolls.json"), rnrPath = path.join(dir, "rnr.json"), overridesPath = path.join(dir, "rnr-overrides.json");
const tollsCsv = path.join(entryDir, `tolls-${routeId}.csv`), facilitiesCsv = path.join(entryDir, `facilities-${routeId}.csv`);

function report(label: string, applied: number, errors: string[]) {
  console.log(`${label}: ${applied} row(s) applied, ${errors.length} problem(s).`);
  for (const error of errors) console.log("  ✗ " + error);
  if (errors.length) process.exitCode = 1;
}

if (mode === "templates") {
  fs.mkdirSync(entryDir, { recursive: true });
  const tolls = read<TollFile>(tollsPath), rnr = read<RnrFile>(rnrPath);
  if (!fs.existsSync(tollsCsv)) { fs.writeFileSync(tollsCsv, buildTollTemplate(tolls)); console.log("wrote " + tollsCsv); } else console.log("kept existing " + tollsCsv);
  if (!fs.existsSync(facilitiesCsv)) { fs.writeFileSync(facilitiesCsv, buildFacilitiesTemplate(rnr)); console.log("wrote " + facilitiesCsv); } else console.log("kept existing " + facilitiesCsv);
} else if (mode === "tolls") {
  const { file, applied, errors } = applyTollRows(read<TollFile>(tollsPath), parseCsv(fs.readFileSync(tollsCsv, "utf8")));
  if (applied) write(tollsPath, file);
  report("tolls", applied, errors);
} else if (mode === "facilities") {
  const rows = parseCsv(fs.readFileSync(facilitiesCsv, "utf8"));
  const before = read<RnrFile>(rnrPath);
  const { file, applied, errors } = applyFacilityRows(before, rows);
  if (applied) {
    write(rnrPath, file);
    // Keep the overrides file in step so rebuilding the stops from OpenStreetMap never loses hand-checked facts.
    const overrides = fs.existsSync(overridesPath) ? read<{ _readme?: string; overrides: Record<string, unknown> }>(overridesPath) : { overrides: {} };
    for (const stop of file.items) {
      const old = before.items.find((s) => s.id === stop.id);
      if (!old || JSON.stringify(old) === JSON.stringify(stop)) continue;
      const row = rows.find((r) => r.stop_id === stop.id)!;
      const entered = Object.fromEntries(["surau", "toilet", "fuel", "ev_charger", "food", "atm"]
        .filter((column) => row[column])
        .map((column) => [column === "ev_charger" ? "evCharger" : column, ["yes", "y", "true"].includes(row[column].toLowerCase())]));
      overrides.overrides[stop.id] = { facilities: entered, source_url: row.source_url, checked_at: row.checked_on, note: "Hand-checked via data/entry sheet. Only the listed fields count." };
    }
    write(overridesPath, overrides);
  }
  report("facilities", applied, errors);
} else {
  console.log("usage: tsx scripts/import-entry.ts <templates|tolls|facilities> [routeId]");
  process.exitCode = 1;
}
