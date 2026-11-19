# Jalan Pulang handover

Jalan Pulang helps people plan the Kuala Lumpur → Ipoh drive along the North–South Expressway. It combines tolls, rest stops, weather and prayer times, then hands the trip off to Google Maps or Waze. Group Arrival is a separate shared event page for coordinating when guests are running late.

## Current release

| Item | Location |
| --- | --- |
| Production app | [Jalan Pulang](https://jalan-pulang.vercel.app/) |
| Group Arrival | [Create an event](https://jalan-pulang.vercel.app/group-arrival) |
| Tester entry | [Tester mode](https://jalan-pulang.vercel.app/?t=1) |
| Print material | [Tester QR](https://jalan-pulang.vercel.app/qr) |
| Hosting | [Vercel project](https://vercel.com/aarntns-projects/jalan-pulang) |
| Source state | Local `main`, production feature commit `8969f1b` |
| Scope and design | [Original brief checklist](FEATURES.md) · [Design handoff](DESIGN_HANDOFF.md) · [README](README.md) |

The release passed 38 automated tests and a production browser test with a host and two separate guests. The host published a revised start time after both guests reported delays. The test also verified that a guest could not reschedule the event. The homepage, Group Arrival, tester mode and QR page returned HTTP 200 on 20 November 2026.

The 65-second demo covers the original trip flow. The mobile comparison captures the perspective-map redesign. Both predate Group Arrival. [Demo video](../Jalan%20Pulang%20Demo.mp4) · [Mobile comparison](../Jalan%20Pulang%20Mobile%20Comparison.png)

## What shipped

- **Plan → Road → Go** covers the precomputed KL → Ipoh corridor, PLUS Class 1 toll lookup, and rest-stop planning for vehicle range, fuel, EV charging, facilities and prayer timing.
- **Trip information** includes MET Malaysia forecasts and best-effort warning matching, source and freshness labels, and heuristic departure estimates with calendar export.
- **Navigation and sharing** include Google Maps waypoints, Waze leg links, browser-only GPS progress, drive simulation, tap-to-call PLUSLine and a downloadable PNG trip card.
- **Mobile and offline** include English and Bahasa Malaysia, a lightweight 3D preview, an interactive map that loads on tap, 2D and full-route views, and an offline route outline. The installed app shell can reuse previously fetched weather and prayer responses.
- **Engagement** includes three tester tasks, optional anonymous feedback, a printable QR and a protected stats page.

The default corridor leaves the expressway at Simpang Pulai. The confirmed Jalan Duta → Simpang Pulai Class 1 fare in the bundled table is RM20.34. Unknown fares link out to PLUS. Tapah Northbound is the known stop for demonstrating a surau and an EV charger. Facility listings describe available facilities, with live occupancy and charger uptime outside the dataset.

## Group Arrival

1. Open **Group Arrival** from **Trip details**, or visit the event creation page. Enter the event name, meeting place and scheduled time in Malaysia time.
2. Share the guest invite link. Save the separate private host link for restoring host access on another device.
3. Guests join using a nickname and can mark themselves on track, delayed by traffic or arrived. A delay report includes an expected arrival time and an optional road stretch.
4. The event page groups two or more reports for the same stretch after normalizing case and spacing. The late count compares reported arrival times with the published start time.
5. The host selects **Change start time**, then **Publish new start time**. The host and joined guests get refreshed updates every 30 seconds while the page is visible. **Refresh** is available for an immediate check.

Group Arrival uses guest-entered information and needs a network connection. Guests with the invite can see shared nicknames and arrival updates. Host and guest credentials are separate, and the app sends no GPS coordinates with reports. Event links close two days after the scheduled start. The private Blob store schedules deletion using whole-day expiration.

## Local setup

Use Node.js 22 or 24 and npm.

```sh
npm ci
npm test
npm run dev
```

Open `http://localhost:3000`. Local Group Arrival rooms use process memory during development unless Blob credentials are configured. Use separate browser profiles to test a host and guests. To check the service worker and offline trip flow, run `npm run build` and `npm start`.

| Setting | Usage |
| --- | --- |
| `BLOB_READ_WRITE_TOKEN` | Server-only credential for the linked private `jalan-pulang-arrivals` Blob store in production. Group Arrival uses it for events. Tester counters and feedback also use it (`stats/counters.json`) when Redis is not configured. |
| `STATS_KEY` | Server-only key for `/stats?key=…`. The production value is configured in Vercel. The Vercel storage setup replaced the local `.env.local` copy. Keep any stats link private. |
| `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` | Optional. When set, tester counters use Redis (preferred under heavy load). The app also accepts the corresponding `KV_REST_API_*` names. Without Redis the counters use the Blob store, then process memory when no Blob token exists (local dev only). |
| `NEXT_PUBLIC_TILE_URL` | Optional raster tile override. The default vector map uses OpenFreeMap with OpenStreetMap data. |
| `GOOGLE_MAPS_API_KEY` | Optional server-side key for generating a dated departure grid with the capped offline script. The current deployment uses the heuristic profile. |

## Where to make changes

| Area | Files |
| --- | --- |
| Main trip, map and mobile layout | [Trip](components/Trip.tsx), [RouteMap](components/RouteMap.tsx), [journey styles](app/journey.css) and [design tokens](app/tokens.css) |
| Group Arrival | [Room and create screens](components/GroupArrival.tsx), [API](app/api/group-arrival/route.ts), [event rules](lib/group-arrival.ts) and [storage](lib/group-store.ts) |
| Data and planner | [Route bundle](data/routes/kl-ipoh), [data registry](lib/data.ts), [planner](lib/planner.ts) and [fixtures](fixtures) |
| Live data and offline | [Weather API](app/api/weather/route.ts), [prayer API](app/api/prayer/route.ts) and [service worker](public/sw.js) |
| Tests | [Test suite](tests) |

Run `npm run probe` to check MET Malaysia and JAKIM endpoints. Pass `--save` to replace fixtures, then update their retrieval timestamps in the matching route handlers. The route builder requests fresh OSRM geometry. The POI builder uses saved inputs and fetches fresh Overpass amenities only with `--fetch-amenities`. Review and retain provenance when changing tolls or facilities.

## Release and demo checks

1. Run `npm test` and `npm run build` from a clean working tree. Check the linked Vercel project and its production environment before deploying. The last release used the Vercel CLI. Confirm that the production alias points to the intended deployment.
2. On a phone, open **Explore 3D map**, switch to 2D, and tap **Full route**. Plan for a toilet, surau and EV charger, then verify Tapah Northbound, weather, navigation links, simulation and trip-card export.
3. In three separate browser profiles, create a Group Arrival event and join from two guest profiles. Have both report the same stretch, publish a later start as host and confirm both guests see it. Check that guest links provide guest controls and that the private link restores host controls.
4. Open tester mode from the QR. Confirm counters using the protected stats page. Counts are approximate sessions, and the memory-backed store can reset.

## Open items

- F11 GTFS-Realtime remains deferred. See the full status of each numbered feature in [FEATURES.md](FEATURES.md).
- Tester counters are Blob-backed in code (ETag-guarded read-modify-write, covered by `tests/counter.test.ts`) but **not yet deployed**. Until the next deploy, production still counts in per-instance memory, so completions from outside testers can be lost. Deploy before sharing the QR. Blob writes serialize, so switch to Redis if traffic becomes heavy.
- A scripted check on 20 November 2026 found the production Plan → Road → Go flow, tester tasks, handoff links, live MET/JAKIM data and Group Arrival host/guest views all working in fresh Chrome profiles. Reports of a "static" or broken flow have not been reproduced. Get the tester's device, browser and URL, since a stale installed service worker is the remaining suspect.
- The outstanding hackathon work recorded in the handoff includes five outside tester completions, checks on physical phones and publishing the social post. Use verified tester results in the [draft post](README.md#demo-and-social-post).
