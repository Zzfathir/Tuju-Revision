import * as turf from "@turf/turf";
import fs from "node:fs";
const f = process.argv[2];
const j = JSON.parse(fs.readFileSync(f, "utf8"));
const coords = j.geometry ? j.geometry.coordinates : j.routes[0].geometry.coordinates;
const line = turf.lineString(coords);
const pts: [string, number, number][] = [["Rawang RnR",3.33,101.5583],["Ulu Bernam",3.6635,101.5193],["Behrang layby",3.7820,101.4464],["Sungai Durian",4.2174,101.2376],["Tapah RnR",4.1788,101.29],["Temoh",4.2578,101.1897],["Gua Tempurung",4.4266,101.1993],["Gopeng toll",4.4532,101.1675],["Bukit Beruntung toll",3.4245,101.5534],["Rawang toll",3.3044,101.5485]];
for (const [n, la, ln] of pts) { const s = turf.nearestPointOnLine(line, turf.point([ln, la]), { units: "kilometers" }); console.log(n.padEnd(22), "km", (s.properties.location as number).toFixed(1), "off m", ((s.properties.dist as number) * 1000).toFixed(0)); }
