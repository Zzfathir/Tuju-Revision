# Landing and onboarding for Jalan Pulang — design

Status: awaiting approval. Size: medium (routing, two new screens, planner pre-fill).

## Intent

Outside testers open the app cold (QR, link) and must grasp, in seconds, what it does (plan the KL → Ipoh drive: tolls, rest stops, weather, prayer times, then hand off to Maps/Waze) and what to tap first. Today `/` drops them into the planner's form with no context. The backend developer owns working wireframes and frontend; visual identity belongs to the designer, so this work reuses existing tokens and invents no brand.

## Goals

- A first screen that states the purpose in one line and shows the Plan → Road → Go path.
- A skippable two-question onboarding that pre-fills the planner (vehicle, needs).
- A full flow testable on a phone: Landing → Onboarding → Plan → Road → Go → share, with Group Arrival reachable from the landing.
- Mobile-first, thumb-reachable primary actions, 44px minimum targets.
- Existing QR codes and `?t=1` tester links keep working.

## Non-goals / anti-goals

- No new brand, palette or fonts (designer's call). Only existing tokens.
- No accounts, sign-in or email capture.
- No backend or API changes.
- Not a marketing site. A pretty page that delays the first tap is a failure.

## Reference patterns (from the Mobbin collection "Jalan Pulang – Map-first 3D navigation UI refs", plus travel onboarding searches)

| Our screen | Pattern borrowed |
| --- | --- |
| Landing | Map as hero, bottom sheet on top: Waymo "26 min to pick-up" summary card, Tesla "Send to Car" single dominant CTA, Transit "Leave at / Arrive at", Google Maps and Tripadvisor 2D/3D toggle |
| Onboarding | Mindtrip "travel style" chip questions with a sticky Next, back arrow and Skip; Pangea segmented progress bar |
| Time choice (Plan) | Waymo departure-time chips; Apple Maps directions list |
| Stop detail (Road) | Rivian and Starbucks bottom-sheet detail with amenity rows; Setel EV card |

## Approaches considered

- A. First-run overlay on `/`: least change, but no real landing and the purpose is hidden behind a dismissible sheet.
- B. Landing at `/`, planner at `/plan`, onboarding between (**chosen by the user**).
- C. Separate `/welcome` carousel: QR visitors never see it.

## Design (approach B)

**Routes**
- `/` landing (server page). `/onboarding` two steps. `/plan` the existing planner (moved from `app/(app)/page.tsx`, unchanged logic).
- `/?t=1` and `/?route=…` redirect to `/plan` with the same query, so printed QR codes keep working.
- `localStorage` flag `jalan-pulang-onboarded` (guarded with try/catch) lets returning visitors go straight to `/plan`.

**Landing** (mobile, one screen, no scroll for the essentials)
```
[ 3D drive preview / map, existing kl-ipoh-drive-preview.webp ]   BM
┌───────────────────────────────────────┐   ← bottom sheet
│ KL → Ipoh, planned in a minute        │
│ 193 km · ~2h 22 · Class 1 toll RM20.34│   ← real values from route bundle
│ ① Plan  ② Road  ③ Go    (step strip)  │
│ [ Plan my drive → ]                   │   ← sticky, thumb-reach
│ Meeting friends? Group Arrival        │
└───────────────────────────────────────┘
```
- Tester mode (`?t=1`): an extra strip "3 quick tasks" above the button.
- Language toggle (EN/BM) as in the planner.

**Onboarding**: step 1 vehicle (Petrol / EV chips), step 2 needs (toilet, surau, EV charger, food, fuel chips). Segmented progress, back, Skip, sticky primary. Answers go to `/plan` via URL parameters, which the planner reads as initial state (EV also sets the default range as it does today).

**Planner changes**: accept initial vehicle/needs from query; add a small header link back to the landing. No logic changes.

**Service worker**: add `/plan` to the shell and navigation lists, bump the cache name so stale clients refresh.

## Constraints

- Next.js 16 App Router, existing CSS (`tokens.css`, `wireframe.css`, `journey.css`), no new dependencies.
- Must pass `npm test` and `npm run build`; existing `data-testid`s stay.

## Verification

Scripted Chrome run at 390×844 from a cold profile: landing → onboarding (and skip) → plan → road → go; `/?t=1` redirect; returning-visitor skip; BM toggle. Screenshots of each screen attached for review.

## Left to the builder

Exact spacing, sheet drag behaviour (static sheet is acceptable), copy in BM, and the preview image crop.
