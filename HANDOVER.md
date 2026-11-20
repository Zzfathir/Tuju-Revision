# Jalan Pulang handover

Jalan Pulang is a Malaysian drive companion. A tester picks any start and destination in Malaysia, gets route options and a rest plan, sees tolls, weather and prayer information where we have data for the road, and can then start **Cruise mode**: a hands-free driving screen with look-ahead alerts. Navigation itself is handed to Google Maps or Waze; the app never routes turn by turn. The verified KL → Ipoh corridor (tolls, R&Rs with confirmed facilities) enhances any route that follows it. Group Arrival is a separate shared event page for coordinating late guests.

## State of the work (read this first)

| Item | Status |
| --- | --- |
| Production | https://jalan-pulang.vercel.app serves deployment `jalan-pulang-cdo2dt1st` (the "interactive map and working step tabs" build). **Nothing after that is deployed.** |
| Branch | `feat/landing-onboarding`. Not merged to `main`. |
| Working tree | **Large and uncommitted.** It mixes your own changes (`Planner`, `DriveHud`, `drive-camera`, `drive-progress`, `presentation.css`, a new landing/onboarding look, `GoCards`, `RouteMap`, `Trip`, `Source`, `sw.js`) with the cruise-mode work described below. Review with `git status` and commit in logical groups before deploying. |
| Automated tests | 232 unit tests in 29 files, all passing on the working tree. Typecheck clean. |
| Browser checks | Run with throwaway Playwright scripts that are **not in the repository** (they lived in a temp folder). Adding them to the repo as an end-to-end suite is a recommended next step. |
| Real phone | **Not tested on a physical phone.** Everything was checked in desktop Chrome with phone-sized viewports and emulated GPS. |

## What exists

### Trip planner (any route in Malaysia)
- **Entry:** `/` (landing, then onboarding, then `/plan`). `/plan` takes `from`, `fromName`, `to`, `toName` parameters, so a trip is a link. The default trip is the verified KL → Ipoh corridor.
- **Place search:** `/api/places` (Photon, capped and cached, with a labelled approximate list of major towns as fallback) and `components/PlaceSearch.tsx`. Recent places are kept in the browser only.
- **Routes:** `/api/route` (OSRM public demo behind a 40 calls/minute cap, 6 hour cache, validated to a Malaysia bounding box; up to 3 alternatives; **never a fake straight line**: it returns 404 `no-route`, 429 `busy` or 503 `unavailable`).
- **Corridor enhancement:** `lib/enrich.ts` gives any route the verified stops and toll plazas it actually *follows* (within 100 m of the highway line for at least 1 km, correct carriageway for R&Rs). A road merely running beside the expressway gets nothing. `lib/trip-route.ts` assembles the trip; the toll is marked partial (`RM 20.34+`) when the route runs beyond the stretch our fares cover.
- **Roads with no verified stops:** `lib/breaks.ts` spaces breaks by drive time with "search near here" links to Google Maps. Break points are never used as navigation waypoints.
- **Never a dead end:** `lib/plan-fixes.ts` offers up to four planner-verified one-tap fixes, simple breaks, or continuing with no planned stops.
- **Weather and prayer times** use the curated corridor only; elsewhere the app says plainly they are not covered yet.

### Cruise mode (new)
Built from `CRUISE_MODE_SPEC.md`. The engine is pure and has no React or map imports:

| Module (`lib/cruise/`) | Role |
| --- | --- |
| `machine.ts`, `config.ts` | State machine IDLE → ARMED → CRUISING ⇄ OFF_ROUTE → ARRIVING → ENDED, and every threshold in one file |
| `pipeline.ts` | Accuracy filter, smoothing, snapping to the route (windowed so a route that doubles back cannot snap to the wrong branch) |
| `intent.ts` | Enter CRUISING (5 good fixes and a matching heading), OFF_ROUTE (over 120 m for 10 s), recovery (3 fixes), NEAR_END |
| `lookahead.ts` | L1 chip at 5 km, L2 card at 2 km, L3 banner at 500 m or 30 s; once per level per event; 8 s voice cooldown; L3 interrupts; Full/Normal/Reduced voice; cards suppressed over 110 km/h |
| `simulator.ts` | Deterministic 1 Hz fake GPS with a speed profile, slow zones at tolls, an injectable detour and a slow-down at the destination |
| `engine.ts` | Composes all of the above; one `push(fix)` returns a snapshot for the screen |
| `voice.ts`, `wakelock.ts`, `zoom.ts` | Browser speech with a Malay-to-English fallback, screen wake lock with visible fallback, speed-based map zoom |

UI: `components/useCruise.ts` (connects GPS or the simulator, voice and wake lock), `components/CruiseHud.tsx` (banner, chips, cards, strip, round controls, off-route Reroute pill, arrived screen), `app/cruise.css`, and in `RouteMap.tsx` the lit ribbon with chevrons ahead of the car, heading-up/north-up and speed zoom. Start it from **Go**: *Start drive view* (real GPS) or *Simulate drive* (60× real time; about two minutes for KL → Ipoh; a *Simulate detour* button appears in simulation only).

Privacy: location is read in the browser and never sent to a server.

### Other features
Landing and onboarding, Group Arrival, tester mode and counters (Blob-backed, durable once deployed), share page, offline shell, English and Bahasa Malaysia. See [FEATURES.md](FEATURES.md).

## Hand-checked data (tolls and R&R facilities)
We never scrape or guess. Fill the sheets in `data/entry/` and import them. See [docs/DATA-ENTRY.md](docs/DATA-ENTRY.md). Toll fares exist for only one of the 13 entry plazas (Jalan Duta); the other 12 are blank and need your hand-checked values. R&R facilities are known for few stops (Tapah is complete).

## Decisions and limits you should know about
- **PLUS fare calculator:** it calls a backend that answers only its own website. Retrying with forged `Origin` and `Referer` headers would impersonate their site, so it was refused. The PLUS facilities page shows only 10 entries without script-driven filters; that was also left alone. Both are replaced by the entry sheets.
- **Cruise thresholds are starting values** from the spec, not validated on a real drive. Tune them in `lib/cruise/config.ts`.
- **Hairpin ramps** (for example the Sungai Buloh interchange) can read well off the route for a few seconds under the smoothing filter. This is why OFF_ROUTE needs 10 sustained seconds. It is documented in `tests/cruise-pipeline.test.ts`.
- **Simulated time:** the simulator emits true 1 Hz fixes in fast bursts, so its ETA is on a simulated clock. Real GPS uses real time.
- **A transient GPS loss no longer ends a drive** (it did before): only a permission refusal does. A "GPS signal lost" notice shows instead.
- **Simulation is a source, not a state.** The spec's table and acceptance criteria contradicted each other; the ruling is recorded in [the cruise plan](docs/superpowers/plans/2026-11-21-cruise-mode.md).
- **No speed-limit badge:** there is no verified speed-limit data (spec 14.3).
- **Not verified:** iOS installed-app wake lock behaviour, Bahasa Malaysia voice availability on real phones, background tracking (not supported, and not claimed), Singapore is inside the bounding box so a route there simply finds no road.
- **No Figma URL** was found in the repository. Cruise visuals follow the existing UI and your Amap reference image; compare against the Figma file and adjust `app/cruise.css` and the tokens.
- **A file was overwritten by mistake:** `tests/drive-camera.test.ts` was your untracked file and was replaced without being read. Coverage was rebuilt for all three functions in `lib/drive-camera.ts` (12 tests), but if you have the original, compare it.

## Local setup

Use Node.js 22 or 24 and npm.

```sh
npm ci
npm test            # 232 unit tests
npm run dev
```

Open `http://localhost:3000`. To check the service worker, offline flow or a production build, run `npm run build` and `npm start`. Group Arrival refuses in-memory rooms in a production build without a Blob token (by design), so create events in `npm run dev` or on the deployed site.

| Setting | Usage |
| --- | --- |
| `BLOB_READ_WRITE_TOKEN` | Server-only. Group Arrival events and tester counters/feedback (`stats/counters.json`). |
| `STATS_KEY` | Server-only key for `/stats?key=…`. Keep any stats link private. |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Optional durable counters (also accepts `KV_REST_API_*`). Without Redis the counters use Blob. |
| `NEXT_PUBLIC_TILE_URL` | Optional raster tile override. Default is OpenFreeMap vector tiles. |
| `GOOGLE_MAPS_API_KEY` | Optional, offline scripts only, for a dated departure grid. |

## Where to make changes

| Area | Files |
| --- | --- |
| Landing and onboarding | `components/Landing.tsx`, `components/Onboarding.tsx`, `lib/onboarding.ts`, `app/landing.css` |
| Planner shell, search, route options | `components/Planner.tsx`, `TripShell.tsx`, `Trip.tsx`, `PlaceSearch.tsx`, `RouteCard.tsx`, `RouteOptions.tsx`, `lib/trip-route.ts`, `lib/enrich.ts`, `lib/breaks.ts`, `lib/plan-fixes.ts` |
| Server proxies | `app/api/places/route.ts`, `app/api/route/route.ts`, `lib/cache.ts`, `lib/limiter.ts` |
| Cruise mode | `lib/cruise/*`, `components/useCruise.ts`, `components/CruiseHud.tsx`, `components/GoCards.tsx`, `app/cruise.css` |
| Map | `components/RouteMap.tsx`, `lib/drive-camera.ts`, `lib/drive-progress.ts`, `public/drive-car.png` (rendered by `design/blender/build_car.py`) |
| Styling | `app/tokens.css` (designer edits here), `app/map-first.css`, `app/presentation.css` |
| Data | `data/routes/kl-ipoh`, `data/entry/*.csv`, `data/places-my.json`, `scripts/import-entry.ts` |
| Group Arrival, counters, offline | `components/GroupArrival.tsx`, `app/api/group-arrival`, `lib/counter.ts`, `public/sw.js` |

## Release checklist
1. Review and commit the working tree in logical groups. Run `npm test`, `npx tsc --noEmit` and `npm run build`.
2. Confirm production has `BLOB_READ_WRITE_TOKEN` and `STATS_KEY` (`vercel env ls production`). Deploy with the Vercel CLI and confirm the alias points to the new deployment.
3. On a **physical phone**: plan KL → Penang and KL → Kota Bharu, confirm weather says "not covered" on the second; start Cruise with real GPS in a moving car if possible, otherwise Simulate; check voice, mute, the screen staying on, off-route and arrived.
4. In three browser profiles run a Group Arrival event with two guests and a host reschedule.
5. Open tester mode from the QR and confirm counts on the protected stats page. Subtract any test traffic you generated.

## Open items
- Hand-check toll fares and R&R facilities into the entry sheets, then import.
- Real-phone test of Cruise (GPS accuracy, speech, wake lock) and tune `lib/cruise/config.ts`.
- Add the browser checks to the repository as a proper end-to-end suite.
- Weather and prayer times for arbitrary routes (needs a gazetteer or reverse lookup; today they cover only the KL → Ipoh corridor).
- F11 GTFS-Realtime remains deferred. Five outside tester completions and the social post are still outstanding.
- Earlier review minors still deferred: Blob error-text matching on first write, no retry backoff, planner home link drops `route`, collapsing the tester card drops a feedback draft, onboarding focus management, brief hydration window on the returning-visitor button.
