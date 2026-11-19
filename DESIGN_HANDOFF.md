# Jalan Pulang wireframes

The app uses system fonts, rectangular controls, and a single scrollable bottom panel under the route map. Edit `app/tokens.css` for colour, spacing, type, borders, focus, tap targets, and layout. `app/wireframe.css` applies the tokens. `lib/i18n.ts` contains the main English and Bahasa Malaysia trip copy. The trip card layout lives in `lib/trip-card.ts` and reads canvas colours and typography from the CSS tokens.

| Surface | Component hooks | States |
|---|---|---|
| Plan | `screen-plan`, `route-map`, `departure`, `card-toll`, `toll-entry`, `toll-exit`, `card-leave`, `need-*` | Known fare, unknown fare, invalid plaza order, festive and normal estimate, dated prediction, route outline fallback |
| Road | `screen-road`, `card-plan`, `card-stop`, `card-weather`, `card-prayer` | Loading, feasible, direct trip, infeasible, warnings, no matches, unavailable, cached, stale, estimate, unverified facilities |
| Go | `screen-go`, `card-handoff`, `nav-google`, `nav-waze`, `card-progress`, `drive-progress`, `card-emergency` | Links by leg, idle, locating, location unavailable, simulating, off-route, arrival |
| Tester mode | `tester-tasks`, `tester-task-1` through `tester-task-3` | Ready, pending, complete, feedback, submission error |
| Support pages | `screen-share`, `screen-qr`, `screen-about`, `screen-stats`, `screen-states` | Share preview and empty state, printable QR, data sources, protected stats, component state samples |

- `.panel`, `.page`, `.row`, `.stack` use the `--space-*` scale and `--content-max-w`.
- `.btn`, `.input`, `.select`, and `.check` use `--tap-min`, `--focus-ring`, typography, border, and accent tokens.
- `.card[data-state]`, `.source[data-status]`, `.badge[data-on]`, and `.banner[data-kind]` expose status separately from layout. `badge-source` is shared across data surfaces.
- `.map-wrap` and `.marker` use `--map-h`, `--map-line-width`, `--color-route`, and `--color-stop`.
- `/states` shows source and card states, disabled controls, facility badges, and the trip card placeholder. The full interactive versions are in Plan → Road → Go.
