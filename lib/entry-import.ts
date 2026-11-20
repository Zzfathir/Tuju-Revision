import type { FacilityKey, RnrFile, TollFile } from "./schemas";

export type CsvRow = Record<string, string>;
export type ImportResult<T> = { file: T; applied: number; errors: string[] };

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Provenance links must be https and carry no embedded credentials. */
function isHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch { return false; }
}

/**
 * Minimal RFC 4180 reader: quoted fields, doubled quotes, CRLF, blank lines. First row is the header.
 * A quote only opens a quoted field at the start of a field; elsewhere it is a literal character.
 * Input that ends inside a quoted field is an error, never silently flushed.
 */
export function parseCsv(text: string): CsvRow[] {
  const rows: string[][] = [];
  let field = "", row: string[] = [], quoted = false, atStart = true;
  const endField = () => { row.push(field); field = ""; atStart = true; };
  const endRow = () => { endField(); if (row.some((value) => value.trim() !== "")) rows.push(row); row = []; };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"' && atStart) { quoted = true; atStart = false; }
    else if (ch === ",") endField();
    else if (ch === "\n") endRow();
    else if (ch !== "\r") { field += ch; atStart = false; }
  }
  if (quoted) throw new Error("CSV ended inside a quoted field (unterminated quote)");
  if (field !== "" || row.length) endRow();
  const [header, ...body] = rows;
  if (!header) return [];
  const keys = header.map((name) => name.trim());
  return body.map((cells) => Object.fromEntries(keys.map((key, index) => [key, (cells[index] ?? "").trim()])));
}

// Names come from OpenStreetMap, which anyone can edit. A leading = + - @ would run as a formula in a spreadsheet.
const quote = (raw: string) => {
  const value = /^[=+\-@\t\r]/.test(raw) ? "'" + raw : raw;
  return /[",\n\r]/.test(value) ? '"' + value.replaceAll('"', '""') + '"' : value;
};
const line = (cells: string[]) => cells.map(quote).join(",");

/** Every forward entry/exit pair. Known fares come pre-filled with their source so the sheet round-trips. */
export function buildTollTemplate(t: TollFile): string {
  const plazas = [...t.plazas].sort((a, b) => a.distanceAlongRoute_km - b.distanceAlongRoute_km);
  const out = [line(["entry_id", "entry_name", "exit_id", "exit_name", "fare_rm", "source_url", "checked_on"])];
  plazas.forEach((entry, i) => plazas.slice(i + 1).forEach((exit) => {
    const fare = t.fares[entry.id]?.[exit.id];
    out.push(line([entry.id, entry.name, exit.id, exit.name, fare == null ? "" : String(fare), fare == null ? "" : t.source_url, fare == null ? "" : t.retrieved_at]));
  }));
  return out.join("\n") + "\n";
}

const COLUMNS: [column: string, key: FacilityKey][] = [
  ["surau", "surau"], ["toilet", "toilet"], ["fuel", "fuel"], ["ev_charger", "evCharger"], ["food", "food"], ["atm", "atm"],
];

/** Hand-checked stops come pre-filled. Unverified OpenStreetMap guesses appear only as a hint, never in an editable column. */
export function buildFacilitiesTemplate(r: RnrFile): string {
  const out = [line(["stop_id", "stop_name", "direction", "km", "osm_hint", ...COLUMNS.map(([column]) => column), "source_url", "checked_on"])];
  for (const stop of r.items) {
    const cells = COLUMNS.map(([, key]) => stop.verified ? (stop.facilities[key] === true ? "yes" : stop.facilities[key] === false ? "no" : "") : "");
    const hint = stop.verified ? "" : COLUMNS.filter(([, key]) => stop.facilities[key] === true).map(([column]) => column).join("|");
    out.push(line([stop.id, stop.name, stop.direction, String(stop.distanceAlongRoute_km), hint, ...cells, stop.verified ? stop.source_url : "", stop.verified ? stop.retrieved_at : ""]));
  }
  return out.join("\n") + "\n";
}

function provenanceError(row: CsvRow): string | null {
  if (!isHttpsUrl(row.source_url ?? "")) return "needs an https source_url (the page you checked)";
  if (!DATE.test(row.checked_on ?? "")) return "needs checked_on as YYYY-MM-DD";
  return null;
}

export function applyTollRows(file: TollFile, rows: CsvRow[]): ImportResult<TollFile> {
  const next = structuredClone(file);
  const errors: string[] = [];
  let applied = 0, latest = "";
  rows.forEach((row, index) => {
    if ((row.fare_rm ?? "") === "") return;
    const where = `Row ${index + 2} (${row.entry_id}→${row.exit_id})`;
    const entry = next.plazas.find((p) => p.id === row.entry_id);
    const exit = next.plazas.find((p) => p.id === row.exit_id);
    const fail = (message: string) => { errors.push(`${where}: ${message}`); };
    if (!entry || !exit) return fail("unknown plaza id");
    if (exit.distanceAlongRoute_km <= entry.distanceAlongRoute_km) return fail("exit must come after entry in the direction of travel");
    if (!/^\d+(\.\d{1,2})?$/.test(row.fare_rm) || Number(row.fare_rm) <= 0 || Number(row.fare_rm) > 500) return fail(`"${row.fare_rm}" is not a valid fare in RM`);
    const missing = provenanceError(row);
    if (missing) return fail(missing);
    if (next.fares[entry.id]?.[exit.id] === Number(row.fare_rm)) return; // already recorded: nothing to change
    next.fares[entry.id] = { ...next.fares[entry.id], [exit.id]: Number(row.fare_rm) };
    applied++;
    if (row.checked_on > latest) latest = row.checked_on;
  });
  if (applied) { next.retrieved_at = latest; next.note = file.note.replace(/ Hand-checked fares added from the entry sheet\.$/, "") + " Hand-checked fares added from the entry sheet."; }
  return { file: next, applied, errors };
}

const YES = new Set(["yes", "y", "true"]);
const NO = new Set(["no", "n", "false"]);

/** What was actually applied, normalised. Callers (such as the overrides file) must use this, never the raw rows. */
export type FacilityEntry = { stopId: string; facilities: Partial<Record<FacilityKey, boolean>>; source_url: string; checked_on: string };

export function applyFacilityRows(file: RnrFile, rows: CsvRow[]): ImportResult<RnrFile> & { entries: FacilityEntry[] } {
  const next = structuredClone(file);
  const errors: string[] = [];
  const entries: FacilityEntry[] = [];
  let applied = 0;
  rows.forEach((row, index) => {
    const entered = COLUMNS.filter(([column]) => (row[column] ?? "") !== "");
    if (!entered.length) return;
    const where = `Row ${index + 2} (${row.stop_id})`;
    const stop = next.items.find((s) => s.id === row.stop_id);
    if (!stop) { errors.push(`${where}: unknown stop id`); return; }
    const values: [FacilityKey, boolean][] = [];
    for (const [column, key] of entered) {
      const value = row[column].toLowerCase();
      if (YES.has(value)) values.push([key, true]);
      else if (NO.has(value)) values.push([key, false]);
      else { errors.push(`${where}: ${column} must be yes, no or blank, not "${row[column]}"`); return; }
    }
    const missing = provenanceError(row);
    if (missing) { errors.push(`${where}: ${missing}`); return; }
    const unchanged = values.every(([key, value]) => stop.facilities[key] === value) && stop.verified && stop.source_url === row.source_url && stop.retrieved_at === row.checked_on;
    if (unchanged) return; // already recorded: nothing to change
    for (const [key, value] of values) stop.facilities[key] = value;
    Object.assign(stop, {
      verified: true, source_url: row.source_url, retrieved_at: row.checked_on,
      facilities_source: `Hand-checked (${row.checked_on}): ${row.source_url}; remaining fields unknown or from OpenStreetMap`,
    });
    entries.push({ stopId: stop.id, facilities: Object.fromEntries(values), source_url: row.source_url, checked_on: row.checked_on });
    applied++;
  });
  return { file: next, applied, errors, entries };
}
