import fs from "node:fs/promises";
import path from "node:path";
import { ESolat, MetForecasts, MetWarnings } from "../lib/schemas";

const sources = [
  { file: "weather-warning.json", url: "https://api.data.gov.my/weather/warning/?limit=50", schema: MetWarnings },
  { file: "weather-forecast.json", url: "https://api.data.gov.my/weather/forecast/?limit=2000", schema: MetForecasts },
  ...["WLY01", "SGR01", "PRK02"].map((zone) => ({
    file: "esolat-month-" + zone + ".json",
    url: "https://www.e-solat.gov.my/index.php?r=esolatApi/takwimsolat&period=month&zone=" + zone,
    schema: ESolat,
  })),
];

async function main() {
  const save = process.argv.includes("--save");
  for (const { file, url, schema } of sources) {
    try {
      const response = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(10_000) });
      if (!response.ok) throw new Error("HTTP " + response.status);
      const payload: unknown = await response.json();
      schema.parse(payload);
      if (save) await fs.writeFile(path.join("fixtures", file), JSON.stringify(payload, null, 2) + "\n");
      console.log(file + " validated" + (save ? " and saved" : ""));
    } catch (error) {
      console.error(file + ": " + (error instanceof Error ? error.message : error));
      process.exitCode = 1;
    }
  }
}

void main();
