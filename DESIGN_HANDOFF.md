# Jalan Pulang interface

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
