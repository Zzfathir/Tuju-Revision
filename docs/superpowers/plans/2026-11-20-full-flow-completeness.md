# Full-flow completeness: gap analysis and plan

Sources compared: the TuJU research report, `CLAUDE_CODE_PROMPT.md` (the original build brief), the deployed app, and measurements taken on 20 Nov 2026.

## What "can't do a full flow" turned out to mean (measured)

| # | Gap | Evidence | Effect on a tester |
| --- | --- | --- | --- |
| G1 | **Only one route exists** (KL → Ipoh). No way to choose another origin/destination. | `lib/data.ts` registry has one entry; the planner is reachable only via `?route=` and no UI offers it. | Anyone not going to Ipoh cannot use the app at all ("one area"). |
| G2 | **Toll picker is a dead end for 12 of 13 entry plazas.** | `tolls.json` fares: only the Jalan Duta row has numbers; every other entry row is `null`. | Choose any entry but Jalan Duta and the answer is always "check with PLUS". |
| G3 | **R&R facilities are mostly unknown.** | 7 stops. `surau` is known for 1 of 7, `evCharger` for 1 of 7, `fuel` 2 of 7. | A "surau + EV" plan can only ever stop at Tapah. |
| G4 | **Infeasible plans block the flow with no way out.** | 640 of 2,560 setting combinations are infeasible (all "range": EV under about 190 km); Continue is disabled. | The tester is stuck on Plan with a red message. |
| G5 | **Brief items not built:** draggable 3-snap bottom sheet, layer toggles (weather / R&R), route-alternative chips, auto Lite mode (FPS / device memory), per-segment emergency numbers (only PLUSLine), departure grid from Google Routes (no key). | `FEATURES.md` vs brief sections 4 and 7. | Polish and depth, not blockers. |
| G6 | **Fixed in this session already:** durable tester counters, working tabs, interactive map, landing and onboarding. | commits on `feat/landing-onboarding` | n/a |

The planner solver is sound: the only infeasibilities are the EV-range ones above, and they come from G3 (unknown chargers), not from the algorithm.

## Decision needed from you (blocked, not guessed)

**Toll fares for other entry plazas (G2).** PLUS's calculator calls a backend that only answers its own website. Plain requests return nothing, and sending forged `Origin`/`Referer` headers would be impersonating their site, which I will not do. Options: (a) you approve driving the real calculator page in a browser once, politely paced, for the missing pairs (about 66 lookups), (b) you hand-enter fares from the PLUS page, (c) accept "check with PLUS" for non-Jalan-Duta entries and make that state clear and useful. The plan below uses (c) until you choose.

## Phases (priority order)

### Phase 1: Verified R&R facilities from the PLUS directory (G3)
**Status: blocked on a decision.** The directory's static page lists only 10 entries (Yong Peng to Tangkak, alphabetical). The rest load through the site's filter plugin and script-driven AJAX, which I will not reimplement or forge. The 10 static entries only restate what is already recorded (Tapah, Tanjong Malim). Options: you hand-check the missing R&Rs in the PLUS app, or you approve a paced browser session clicking the site's own filters (about 8 views).

- Save the PLUS facilities page to `fixtures/plus-facilities.html` (one plain GET, normal headers).
- `scripts/parse-plus-facilities.ts` extracts `{name, direction, facilities[]}` per accordion entry; `lib/plus-facilities.ts` holds the pure parser.
- Merge into `rnr-overrides.json`-style data: known facilities from the directory overwrite `null`; anything the directory does not list stays `null`. Record `source_url` and `checked_at` per stop.
- Tests: parser fixtures (Tapah northbound has surau + EV + ATM; an entry with no EV stays `null`/absent, never `false`); every stop's facilities obey the schema.

### Phase 2: Never a dead end on Plan (G4)
**Status: done.** `lib/plan-fixes.ts` (+7 tests), planner UI, browser checks t9 (10/10).

- When the plan is infeasible, show the reason in plain words plus concrete one-tap fixes ("Allow a longer drive between stops", "Remove EV charger need", "I'll charge before leaving") computed from the planner, and let the tester continue with a clearly labelled **"No stops planned"** route.
- Tests: pure `suggestRelaxations(input)` returns changes that make the plan feasible; EV 150 km range returns at least one suggestion; Continue is enabled after choosing "continue without stops".

### Phase 3: A second and third route (G1)
**Status: not started; waiting for confirmation that this is what "one area" means.**

- Route registry stays data-only. Add a route picker (origin → destination chips) to the landing and planner header.
- Routes chosen for data we can verify without the blocked API: **KL → Penang (Juru)** and **KL → Johor Bahru**, each built with the existing scripts (OSRM geometry once, OSM plazas and R&Rs, PLUS facilities from Phase 1). Fares stay `null` and labelled until the decision above.
- Each route needs: config (prayer zones, MET location ids), gazetteer, tests that every data file validates and every stop projects onto its line.

### Phase 4: Brief polish, only if time remains (G5)
Layer toggles, route chips, Lite-mode auto-switch. Not started.

## Definition of done for this plan
A tester can pick a route, plan with any need combination without a dead end, see verified facilities, and complete Plan → Road → Go for each route. Anything unverified is tagged, never invented.
