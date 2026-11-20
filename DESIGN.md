# Jalan Pulang design system

Jalan Pulang is a map-first driving app for long Malaysian road trips (for example KL to Ipoh). It opens straight onto the map, adds **side quests** (optional detours that earn XP) and a **Garage** for choosing the car shown on the map.

The visual language follows **Waze**: a light grey canvas, white sheets with soft shadows, a bright blue pill CTA, grey secondary buttons, a purple route, and a black driving banner with cyan street names. A small game layer (quests, XP, rewards) sits on top.

- **Figma (source of truth):** [Jalan Pulang · Mobile app · design system](https://www.figma.com/design/74o0ko7zREzSxeixtiiB7c/Jalan-Pulang-%C2%B7-Mobile-app---design-system)
  - `01 · Mobile screens`: the map-first flow (screens 00–07) and the drive-map states
  - `02 · Design system`: variables, text styles, effect styles, components
  - `99 · Archive`: screens removed from the flow (welcome, home, vehicle, stop preferences, group arrival, and so on)
- **References:** Waze for iOS on Mobbin (map, route sheet, place info, report menu, settings).
- **Code:** the app's tokens live in `app/tokens.css`. Nothing in the app code uses this system yet; see [Mapping to code](#mapping-to-code).

## Principles

1. **Map first.** The app opens on the map. Everything else is a sheet or an overlay on top of it, never a separate home screen.
2. **One primary action per view.** One blue pill button. Everything else is a grey secondary button or a link.
3. **Calm surfaces, loud signals.** Surfaces stay white and grey. Colour is reserved for the route (purple), hazards and quests (yellow), XP (green), and danger (red).
4. **Drive-safe while moving.** While driving: dark banner, large numbers, few words, no dense lists.
5. **The game layer is optional.** Quests and XP never block navigation. Every quest screen has a "Later" option.

## Colour

All colour comes from Figma variables. Use the **semantic** tokens in designs and code; the primitive tokens only exist to feed them.

### Semantic tokens

| Token | Primitive | Hex | Use |
|---|---|---|---|
| `Color/Canvas` | grey-100 | `#F2F3F7` | Screen background behind cards and sheets |
| `Color/Surface` | white | `#FFFFFF` | Sheets, cards, rows, bottom bars |
| `Color/Surface muted` | grey-150 | `#ECEDF1` | Secondary buttons, search field, chips, stat tile boxes |
| `Color/Surface selected` | blue-tint | `#EAF2FF` | Selected chip, Home tile, live labels |
| `Color/Surface warning` | yellow-tint | `#FFF6DB` | Quest panels, warning banners |
| `Color/Action` | waze-blue | `#4496F7` | Primary button fill, selected 2D/3D control, current bar in charts |
| `Color/Link` | link-blue | `#3074DA` | Secondary button text, links, "Save place", icons in chips |
| `Color/Text` | ink | `#222222` | Primary text |
| `Color/Text secondary` | grey-600 | `#6D7178` | Metadata, addresses, captions |
| `Color/Border` | grey-200 | `#E4E6EB` | Dividers, grabbers, unchecked boxes |
| `Color/Warning text` | yellow-dark | `#7A5300` | Text on `Surface warning`, quest category labels |
| `Color/Positive text` | green-dark | `#1E8A44` | "Open now" pill, positive status text |
| `Color/Route` | route-purple | `#6431B4` | Active route line |
| `Color/Route casing` | route-purple-dark | `#4608A3` | Outline around the route line, ETA bubble |
| `Color/Route alternate` | route-lilac | `#B68BF7` | Alternative routes |
| `Color/Hazard` | hazard-yellow | `#F6C743` | Hazards, star ratings |
| `Color/Quest` | hazard-yellow | `#F6C743` | Quest markers, quest tiles |
| `Color/XP` | mint-green | `#5DC579` | Level badge, XP chips, completed checks |
| `Color/Danger` | traffic-red | `#EC605B` | Place pin, errors, traffic |
| `Color/Report` | report-orange | `#F5A05A` | Report button, food category icon |
| `Color/Stop` | stop-pink | `#F09594` | "Stop" button while driving |
| `Color/Brand background` | black | `#000000` | Driving banner |
| `Color/Brand accent` | waze-cyan | `#66C9FA` | Brand highlights |
| `Color/HUD surface` | grey-950 | `#1F2123` | Quest tracker, XP badge, reward toast, dark map buttons (55% opacity) |
| `Color/HUD text` | white | `#FFFFFF` | Text on HUD surfaces and the banner |
| `Color/HUD street` | waze-cyan | `#66C9FA` | Street or stop name in the driving banner |
| `Color/Chart` | blue-light | `#A9CFFB` | Non-current bars in charts |
| `Color/Indicator` | blue-tint-strong | `#D6E8FF` | Active tab or nav indicator (reserved) |
| `Color/Section band` | grey-100 | `#F2F3F7` | Thick dividers between list groups |

### Colour rules

- **Use the route colours only for routes.** Purple and lilac are never used for buttons or text.
- **Yellow means "pay attention".** It is used for hazards, quests and ratings, never for decoration.
- **Use green text only for "open" or "done".** Use `Positive text` for words and `XP` for fills.
- **On dark surfaces** (banner, HUD), use only `HUD text`, `HUD street`, `Quest` and `XP`.

### Contrast

| Pair | Ratio | Status |
|---|---|---|
| Text `#222222` on Surface | 15.9:1 | Pass |
| Text secondary `#6D7178` on Surface | 4.9:1 | Pass (AA body) |
| Link `#3074DA` on Surface | 4.5:1 | Pass (AA body) |
| Positive text `#1E8A44` on Surface | 4.4:1 | Large or bold text only |
| Warning text `#7A5300` on Surface warning | 6.4:1 | Pass |
| HUD street `#66C9FA` on black | 11:1 | Pass |
| White on Action `#4496F7` | **3.0:1** | **Fails AA for 15px labels.** This is Waze's real button colour. If the team wants AA, use `#3074DA` as the button fill. |

## Typography

**Use one font: [Geist](https://vercel.com/font).** Do not add other families. In the Figma file, no layer uses anything other than Geist.

| Style (Figma) | Weight | Size / line height | Tracking | Use |
|---|---|---|---|---|
| `Text / Large Title` | Bold | 26 / 32 | -2% | Screen titles ("Side quests", "Garage") |
| `Text / Title 3` | SemiBold | 18 / 24 | -1% | Section titles, sheet headings |
| `Text / Headline` | SemiBold | 15 / 20 | -0.5% | Row titles, section headers, button labels |
| `Text / Body` | Regular | 15 / 20 | 0 | Body copy, addresses, list rows |
| `Text / Footnote` | Regular | 12 / 16 | 0 | Metadata, captions, tile labels |
| `HUD / Display` | Black | 30 / 32 | -3% | Big driving numbers ("66 km"), reward amounts |
| `HUD / Title` | Bold | 18 / 22 | -1.5% | Quest titles on dark surfaces, metric values |
| `HUD / Label` | SemiBold | 10 / 12 | +6%, UPPERCASE | Overlines ("SIDE QUEST · FOOD"), XP chips |

- The place title on detail pages is Geist Bold 20 (Title 3 with an override).
- Don't go smaller than 12px for text or 10px for uppercase labels.
- Align text left. The only exceptions are tile values and the labels under round tiles.

## Spacing, size and radius

| Token | Value | Use |
|---|---|---|
| `Space/4` | 4 | Text-to-text inside a block |
| `Space/8` | 8 | Chip gaps, tile gaps |
| `Space/12` | 12 | Card padding, button gaps |
| `Space/16` | 16 | Screen side margin, sheet padding |
| `Space/24` | 24 | Sheet side padding on map screens |
| `Space/32` | 32 | Large section gaps |
| `Size/44` | 44 | Minimum tap target, map control buttons |
| `Size/52` | 52 | Button height |
| `Radius/12` | 12 | Small cards, metric tiles |
| `Radius/16` | 16 | Cards, quest panels, photo grid, place sheet top |
| `Radius/24` | 24 | Bottom sheets on map screens (top corners) |
| `Radius/pill` | 999 | Buttons, chips, search field, XP badge, toasts |

Screen size in Figma: **390 × 844**. Keep a 16px side margin. Leave 34px of bottom padding above the home indicator.

## Elevation

| Effect style | Shadow | Use |
|---|---|---|
| `Elevation / Card` | y 1, blur 3, black 6% | Cards and rows on the canvas |
| `Elevation / Sheet` | y −2, blur 16, black 10% | Bottom sheets and sticky bottom bars |
| `Elevation / Floating button` | y 2, blur 8, black 12% + hairline 4% | Map controls, markers, toasts, category badge |

Cards use a shadow, not a border. Use dividers (`Border`) only between rows and sections.

## Components

All components are on the `02 · Design system` page.

### Foundations

| Component | Notes |
|---|---|
| `Brand / Mark on light`, `Brand / Mark on dark` | App mark |
| `Icon / Disclosure`, `Back`, `Checkmark`, `Search` | 18px line icons |
| `Icon / Place / *` | Directions, Add stop, Save, Share, Call, Address, Hours, Website. Recolour with `Link` or `Text`. |

### Actions and inputs

| Component | Variants | Notes |
|---|---|---|
| `Action / Button` | Primary, Secondary, Disabled, On dark primary, On dark secondary | Pill, 52px. **Primary:** `Action` fill with white text. **Secondary:** `Surface muted` fill with `Link` text (Waze's "Later" or "Go later"). In a bottom bar, put the secondary button on the left at a fixed width and let the primary button fill the rest. |
| `Input / Choice chip` | Default, Selected | Pill. Default: `Surface muted`. Selected: `Surface selected` with a check. Text is `Link`. |
| `Input / Search field` | — | Grey pill. Placeholder copy is "Where to?". |
| `Navigation / Back button` | — | "‹ Back" in `Action` |
| `Map / Perspective control` | Selected, Default | 2D/3D toggle |
| `Map / Control button` | — | Round white floating button, 44px |

### Data and lists

| Component | Notes |
|---|---|
| `List / Detail row`, `List / Disclosure row` | White row, radius 16, card shadow |
| `Data / Summary card` | Route summary |
| `Data / Metric` | Value plus label on `Surface muted`. Values use `HUD / Title`. |
| `Data / Source label` | Data-quality status: Verified, Estimate, Stale, Unavailable, Live, Cached, Unverified |

### Place detail (Waze place info)

| Component | Notes |
|---|---|
| `Place / Category badge` | 56px white circle with a category icon. It overlaps the top-left of the place sheet. |
| `Place / Open pill` | Green pill: "Open now · until 11 pm ▸". Edit the `Detail` text property. |
| `Place / Section header` | Left-aligned Headline with a top divider. Edit the `Title` property. |
| `Place / Stat tile` | Value in a grey box with a label underneath, like Waze gas prices. Use it for quest rewards and short stats, not for long lists. |

### Game layer

| Component | Notes |
|---|---|
| `Game / Quest marker` | Yellow diamond with "!", for side quests on the map |
| `Game / XP badge` | Dark pill with the level circle, rank and progress bar. Sits top-left on the map. |
| `Game / Quest tracker` | Dark card under the driving banner: overline, quest title, next objective |
| `Game / Quest card` | White row in the quest sheet: icon tile, title, detour cost, XP and category chips |
| `Game / Reward toast` | Dark pill with a star: "QUEST COMPLETE · +150 XP" |
| `Garage / Color swatch` | 44px paint circle. Selected state adds a 3px `Action` outer ring. |

## Screens and patterns

### 00 · Map home (launch)

The app opens here.

- **The map**, with the vehicle and quest markers.
- **Top-left:** the XP badge.
- **Top-right:** round map controls, with the 2D/3D control below them.
- **Bottom sheet** (radius 24, with a grabber) containing:
  - the "Where to?" search field;
  - four round quick tiles: Home, Side quests, Garage, Recent.

### 01 · Side quests

- The map stays visible above the sheet.
- The sheet has a level overline, the "Side quests" title and a close button.
- Below that: filter chips (On my route, Nearby, Done), then quest cards.

### 02 · Side quest detail

- The map shows the route to the quest marker.
- The sheet has:
  - an overline, a title, and three metrics (detour, added time, XP);
  - an objectives checklist;
  - a "Start side quest" button.

### 03 · Garage

- Large title.
- A 3D preview stage with a turntable and a "Drag to rotate 360°" hint.
- Body-type chips, paint swatches, and extras rows.
- "Drive with this car".
- The car is a placeholder illustration until the real 3D model exists.

### 04 · Driving, side quest active, and 05 · Quest complete

- **Banner:** a black card with the distance in `HUD / Display` and the next stop in `HUD street` cyan.
- **Quest tracker:** pinned under the banner.
- **Quest marker:** on the route ahead.
- **Bottom:** a progress summary.
- **Quest complete:** the reward toast replaces the tracker.

### 06 · Place detail and 07 · Side quest · Place detail

These follow Waze's place info layout.

1. **Map on top** (about 290px), with a red place pin (or the quest marker). Round dark back and close buttons sit at the top left and top right (`HUD surface` at 55%).
2. **White sheet** (radius 16):
   - The category badge overlaps its top-left corner. "☆ Save place" and the "•••" pill sit on the right.
3. **Left-aligned header:**
   - overline (quest only), place name (Bold 20), address, then a distance-and-arrival line;
   - the "Open now" pill underneath.
4. **Sections**, each with a section header and divider:
   - Call link, Opening hours, Onsite services (place page);
   - Quest rewards (stat tiles) and Objectives (quest page).
5. **Sticky bottom bar** with Secondary + Primary buttons: "Go later" + "View routes", or "Later" + "Start side quest".

Don't add tabs, photo carousels, horizontal action chip rows or popular-times charts. Those are Google Maps patterns, and the team decided against them.

### Drive map states

The eight `Drive map · …` frames (simulation, GPS, 2D, 3D follow, exploring, locating, off route) use the same banner, route colours and controls.

## Content

- Write in English, using Malaysian place names and context (R&R, surau, toll, nasi kandar). The archived screens include a Bahasa Malaysia welcome.
- **Buttons** are short verbs, as in Waze: "View routes", "Go later", "Start side quest", "Later".
- **Quests** are framed as a choice, never an obligation. Always show the cost ("4 km detour · adds 12 min") next to the reward ("+150 XP").
- **Distances and times** use a space before the unit: "4 km", "12 min", "11 pm".

## Mapping to code

`app/tokens.css` still holds the previous theme. This is the proposed mapping when the app adopts this system:

| CSS variable | Design token | Value |
|---|---|---|
| `--color-bg` | Canvas | `#F2F3F7` |
| `--color-surface` | Surface | `#FFFFFF` |
| `--color-text` | Text | `#222222` |
| `--color-text-muted` | Text secondary | `#6D7178` |
| `--color-border` | Border | `#E4E6EB` |
| `--color-accent` | Action | `#4496F7` |
| `--color-accent-text` | Link | `#3074DA` |
| `--color-route` | Route | `#6431B4` |
| `--color-stop` | Quest / Hazard | `#F6C743` |
| `--color-state-live` | Positive text | `#1E8A44` |
| `--color-state-error` | Danger | `#EC605B` |
| `--font-body`, `--font-display` | Geist | `"Geist", system-ui, sans-serif` |
| `--font-mono` | Geist Mono | `"Geist Mono", ui-monospace, monospace` |
| `--text-xs` / `--text-sm` / `--text-md` / `--text-lg` / `--text-xl` | Footnote / Body / Title 3 / Large Title / HUD Display | 12 / 15 / 18 / 26 / 30 px |
| `--control-radius` | Radius/pill | `999px` |
| `--sheet-radius` | Radius/24 | `24px` |
| `--small-radius` | Radius/12 | `12px` |
| `--tap-min` | Size/44 | `44px` |
| `--sheet-shadow` | Elevation / Sheet | `0 -2px 16px rgb(0 0 0 / 0.10)` |
| `--map-control-shadow` | Elevation / Floating button | `0 2px 8px rgb(0 0 0 / 0.12), 0 0 1px rgb(0 0 0 / 0.04)` |

Add new variables for tokens without a CSS equivalent yet: `--color-surface-muted`, `--color-quest`, `--color-xp`, `--color-hud`, `--color-hud-street`, `--color-route-casing`, `--color-route-alt`.

## Open items

- **Missing screens:** 9 screens are no longer in the Figma file: Route search, Route selected, Trip overview, Stops and conditions, Rest stop detail, Offline route, Route unavailable, Drive progress, Destination results. Restore them from Figma version history or rebuild them in this system.
- **Garage car:** the car is a 2D placeholder; it needs a real 3D model.
- **Contrast:** white on `#4496F7` is 3.0:1. Decide whether to keep Waze's exact blue or darken it for AA.
- **Placeholder content:** the restaurant name, address and quests on screens 06 and 07 are examples.
