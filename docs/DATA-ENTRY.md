# Entering hand-checked tolls and facilities

The app never guesses. A fare or facility is shown as known only after someone checks it and writes down where. These two sheets are how you add what you have verified.

## Files
- `data/entry/tolls-kl-ipoh.csv` — every entry → exit plaza pair, in the direction of travel. Known fares are pre-filled.
- `data/entry/facilities-kl-ipoh.csv` — every R&R / lay-by. The `osm_hint` column shows what OpenStreetMap suggests; **it is a hint, not a fact**, so the editable columns start blank for anything not yet checked.

## How to fill them in
1. Open the CSV in Excel or Google Sheets (keep it as CSV).
2. **Tolls:** type the Class 1 fare in `fare_rm` (for example `3.20`), put the page you read it from in `source_url`, and the date in `checked_on` as `YYYY-MM-DD`.
3. **Facilities:** in `surau`, `toilet`, `fuel`, `ev_charger`, `food`, `atm` type `yes` or `no`. Leave a cell **blank** if you did not check it. Blank means unknown, never "no". Fill `source_url` and `checked_on` on the same row.
4. Save, then run the importer:
   ```sh
   npm run entry:tolls          # applies the fare sheet
   npm run entry:facilities     # applies the facilities sheet
   ```
5. The importer prints every row it skipped and why (unknown id, wrong direction, missing source, a value that is not `yes` / `no`). Fix those rows and run it again. Re-running is safe: rows already recorded change nothing.
6. Run `npm test`, then redeploy.

## Rules the importer enforces
- A value needs a `source_url` and a `checked_on` date, otherwise the row is rejected.
- Blank never overwrites anything and is never turned into `no`.
- A fare must be a positive amount, and the exit must come after the entry.
- Facilities you enter are also saved to `rnr-overrides.json`, so rebuilding stops from OpenStreetMap cannot lose them.

## Another route later
`npm run entry:templates -- <routeId>` writes fresh sheets for any route that has `tolls.json` and `rnr.json`.
