# Jalan Pulang interface

## Current mobile design

The launch screen, planner, side quests, Garage, place details, and driving HUD follow `DESIGN.md`. The map uses live MapLibre data and keeps the route-outline fallback. The simulation draws the moving car and camera from the same animation frame.

- `app/tokens.css` defines the light palette, Geist, route colours, and elevation. `app/road-ui.css` applies them to the revised flow. The primary blue is darkened for white-label contrast.
- `lib/road-game.ts` holds the prototype quests for known rest areas and the browser-only XP, saved places, and Garage preferences. Quests award XP when the drive reaches the selected stop. The Garage uses an illustrated turntable placeholder.

On phones, the route map leads into a single planning sheet with persistent step actions. On wider screens, the map stays in view beside the sheet. Edit `app/tokens.css` for colour, spacing, type, borders, focus, tap targets, and layout. `app/wireframe.css` applies the tokens. `lib/i18n.ts` contains the main English and Bahasa Malaysia trip copy. The trip card layout lives in `lib/trip-card.ts` and reads canvas colours and typography from the CSS tokens.

| Surface | Component hooks | States |
|---|---|---|
| Plan | `screen-plan`, `route-map`, `departure`, `card-toll`, `toll-entry`, `toll-exit`, `card-leave`, `need-*` | Known fare, unknown fare, invalid plaza order, festive and normal estimate, dated prediction, 3D drive view, flat map, corridor overview, route outline fallback |
| Road | `screen-road`, `card-plan`, `card-stop`, `card-weather`, `card-prayer` | Loading, feasible, direct trip, infeasible, warnings, no matches, unavailable, cached, stale, estimate, unverified facilities |
| Go | `screen-go`, `card-handoff`, `nav-google`, `nav-waze`, `card-progress`, `drive-progress`, `card-emergency` | Links by leg, idle, locating, location unavailable, simulating with a heading-up camera, off-route, arrival |
| Tester mode | `tester-tasks`, `tester-task-1` through `tester-task-3` | Ready, pending, complete, feedback, submission error |
| Support pages | `screen-share`, `screen-qr`, `screen-about`, `screen-stats`, `screen-states` | Share preview and empty state, printable QR, data sources, protected stats, component state samples |

- `.panel`, `.page`, `.row`, `.stack` use the `--space-*` scale and `--content-max-w`.
- `.btn`, `.input`, `.select`, and `.check` use `--tap-min`, `--focus-ring`, typography, border, and accent tokens.
- `.card[data-state]`, `.source[data-status]`, `.badge[data-on]`, and `.banner[data-kind]` expose status separately from layout. `badge-source` is shared across data surfaces.
- `app/journey.css` lays out the map and trip panel. Its map controls, route line and markers use the journey and map tokens in `app/tokens.css`.
- `/states` shows source and card states, disabled controls, facility badges, and the trip card placeholder. The full interactive versions are in Plan → Road → Go.

## Archived Night Ops ("Mod Misi") theme

A dark map theme with glowing diamond pins and a red accent. It is off by default (light stays the daytime theme). It turns on with the **Mod Misi** button in the map header, and automatically when Cruise starts unless the visitor switched it off. The choice is remembered in the browser (`jalan-pulang-night`).

- **Tokens:** everything is in `app/night-ops.css` under `[data-theme="night-ops"]`. The map, pins and cruise HUD all read these. The values are approximate and should be eyedropped from the final palette: `--color-bg`, `--color-panel`, `--color-panel-border`, `--color-accent`, `--color-accent-glow`, `--color-text-muted`, `--map-land`, `--map-water`, `--map-coast-glow`, `--map-road-minor`, `--map-road-major`, `--map-road-motorway`, `--map-label`, `--map-building`, `--pin-green`, `--pin-blue`, `--pin-yellow`, `--pin-red`, `--pin-orange`, plus `--glow-*`, `--pin-size*`, `--blur-glass`.
- **Map style:** `lib/night-ops.ts` (`patchNightOps`) restyles the OpenFreeMap vector style at runtime: black land, grey roads by class, a five-band coast glow, subtle 3D buildings after zoom 14.5 and dark fog. Tests in `tests/night-ops.test.ts`.
- **Pins:** `.pin-diamond` in `night-ops.css`. Categories live in `lib/night-ops.ts` (`PIN_LEGEND`, `stopPin`): green = surau, blue = EV charger, yellow = fuel, red = hazard (reserved, no hazard pins yet), orange = destination. Stops with nothing confirmed get a dashed outline, a "?" badge and no glow. A legend shows on the planning map.
- **Lite:** `data-lite="true"` (set for Save-Data and 2G/3G connections) zeroes glow and blur and uses one coast-glow layer. Reduced-motion switches the pulse off.
- **Fonts:** Barlow and Barlow Condensed via `next/font` (open licence). No third-party game assets, names or fonts.
- Not yet themed: the landing and onboarding pages and `/states`. They keep the light look.
