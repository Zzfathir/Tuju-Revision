# Any route, like an actual app — design and plan

Status: approved in advance by the user ("approve all decisions"). Answers given: (1) not just one route, normal driving anywhere; (2b) the user hand-checks toll and facility facts, so we build entry sheets and an importer instead of scraping. Plus: use the Mobbin wireframes, remove the slop, make it look like a map app.

## Intent
Move past the single-route demo. A tester types any origin and destination in Malaysia, gets real route options and arrival times, a rest plan, weather and prayer information as far as data allows, then hands off to Google Maps or Waze. It must read as a map app (map first, floating search card, draggable bottom sheet), not a form on a page.

## Non-goals and anti-goals
- No own turn-by-turn and no own routing engine. Hand off navigation (TuJU lesson).
- No uncapped paid calls, and no outside call straight from the browser.
- No invented data. Where we have no verified facts (tolls and facilities outside the curated corridor) the app says so and offers a useful next step.
- No accounts. Recent places stay in the browser.

## Evidence (probed 20 Nov 2026)
Photon, Nominatim and the OSRM demo all answer from here. OSRM returned alternatives for KL → Penang (354 and 378 km) and handled Kuching → Miri (711 km). data.gov.my forecasts have 143 locations by name only (no coordinates).

## Architecture
**Server (all outside calls proxied, cached, coalesced, capped, with a fallback):**
- `GET /api/places?q=` — Photon behind a proxy (24 h cache, one upstream call per second at most per instance, Malaysia only). Fallback: a static list of major Malaysian cities, labelled approximate.
- `GET /api/route?from=lat,lng&to=lat,lng` — OSRM behind a proxy: coordinates validated to the Malaysia bounding box and rounded to 4 decimals for the cache key, 6 h cache, a hard per-instance cap, geometry simplified server-side, up to 3 alternatives. On failure the client shows "route preview unavailable" and still offers the Google Maps handoff. Never a straight-line fake.
**Curated data becomes an enhancement:** `lib/enrich.ts` takes any route line and keeps the curated R&Rs and toll plazas that lie within 350 m of it, re-projecting their distance along the new line. A route that follows the North–South Expressway automatically gets verified stops, plazas and fares; others get none and say so.
**Generic planning:** where there are no verified stops the planner proposes break points every N driving minutes and links to a Google Maps search for the facility needed near each point. Honest, and still useful.
**Data entry for the user (option b):** CSV templates under `data/entry/` for toll fares and R&R facilities, and `scripts/import-entry.ts`, which validates (yes / no / blank only, never guessed) and merges into the data files with source and date.
**Weather and prayer times for arbitrary routes:** the weather API accepts sample points; matching uses curated place data where it exists and says "not available for this stretch" elsewhere. Prayer times outside the curated zones use a labelled calculated estimate. (Milestone 2.)

**Client (map first, patterns from the user's Mobbin collection):**
- Full-screen map. A floating from → to card at the top (Apple Maps / Google Maps / Waymo pattern) opens a place search with recent, popular and live results.
- A draggable bottom sheet with three snap points (peek, half, full) holds route options with ETA (Apple Maps list), leave-time chips (Waymo), the stop plan, weather and the primary Go button. On desktop the same sheet is a floating column on the left.
- Existing test hooks (`tab-*`, `btn-next`, `screen-*`) stay so the proven flow keeps working.
- Remove the slop: bracketed monospace source lines become small status pills, raw checkboxes become chips, selects become segmented controls, and cards lose heavy borders. Tokens only; the designer can restyle in `tokens.css`.

## Milestones
1. Data-entry templates and importer (tests).
2. Places and route proxies with fixtures and caps (tests).
3. Enrichment and generic break-point planning (tests).
4. Trip works on any route; search UI and route options.
5. Map-first shell: floating card, snap-point sheet, desktop column, slop removed.
6. Browser checks (phone and desktop), regression, docs. Milestone 2 (weather and prayer for arbitrary routes) is a separate pass.
