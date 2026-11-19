# Landing and Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a map-first landing page at `/` and a two-step skippable onboarding so cold testers understand the app and reach a pre-filled planner at `/plan`.

**Architecture:** A pure helper (`lib/onboarding.ts`) parses and serializes trip preferences (lang, vehicle, needs) to URL parameters. The planner moves unchanged to `/plan` and reads those preferences as initial state. Landing and onboarding are small client components over server pages that supply real route facts.

**Tech Stack:** Next.js 16 App Router, React 19, existing CSS tokens, vitest, playwright-core (scratchpad only, not a dependency).

**Spec:** `docs/superpowers/specs/2026-11-20-landing-onboarding-design.md`

## Global Constraints

- No new dependencies; no new colours or fonts, only variables from `app/tokens.css`.
- No backend or API changes.
- Touch targets at least `var(--tap-min)` (44px); primary action reachable at the bottom of the screen.
- All copy goes in `lib/i18n.ts` with EN and BM entries.
- `localStorage` access is always wrapped in try/catch; every screen works without it.
- Existing `data-testid` values and printed `/?t=1` links keep working.
- `npm test`, `npx tsc --noEmit` and `npm run build` must pass.

## Review Focus

- `vehicle=banana` or unknown `needs` entries in the URL: fall back to petrol and ignore unknown needs, never crash.
- `/?t=1&route=kl-ipoh` and `/?route=x` redirect to `/plan` keeping both parameters.
- Blocked `localStorage` (private window): landing and onboarding still complete the flow.
- BM chosen on the landing stays BM through onboarding and the planner.
- Skip on onboarding reaches `/plan` with defaults and sets the returning-visitor flag.

---

### Task 1: Preference helper

**Files:**
- Create: `lib/onboarding.ts`
- Test: `tests/onboarding.test.ts`

**Interfaces:**
- Produces:
  - `type Prefs = { lang: Lang; vehicle: "petrol" | "ev"; needs: Need[] }` (`Need` from `lib/planner`, `Lang` from `lib/i18n`)
  - `parsePrefs(params: Record<string, string | string[] | undefined>): Prefs`
  - `prefsQuery(prefs: Partial<Prefs>, extra?: Record<string, string>): string` returning `""` or `"?a=b&..."`

- [ ] **Step 1: Write failing tests** in `tests/onboarding.test.ts`:
  - `parsePrefs({})` equals `{ lang: "en", vehicle: "petrol", needs: [] }`.
  - `parsePrefs({ lang: "bm", vehicle: "ev", needs: "toilet,surau" })` equals `{ lang: "bm", vehicle: "ev", needs: ["toilet","surau"] }`.
  - `parsePrefs({ vehicle: "banana", lang: "fr", needs: "toilet,nope,,ev" })` equals `{ lang: "en", vehicle: "petrol", needs: ["toilet","ev"] }`.
  - `parsePrefs({ needs: ["toilet","food"] })` (array form) yields `["toilet","food"]`.
  - `prefsQuery({ lang: "en", vehicle: "petrol", needs: [] })` is `""`; `prefsQuery({ lang: "bm", vehicle: "ev", needs: ["toilet","surau"] }, { t: "1" })` contains `lang=bm`, `vehicle=ev`, `needs=toilet%2Csurau` (or `toilet,surau`) and `t=1`; and `parsePrefs` of its parsed output round-trips.
- [ ] **Step 2: Run** `npx vitest run tests/onboarding.test.ts` — expect FAIL (module missing).
- [ ] **Step 3: Implement** both functions. Valid needs come from the `Need` union in `lib/planner.ts` (read it for the exact set). Omit default values from the query string.
- [ ] **Step 4: Run** the test — expect PASS.
- [ ] **Step 5: Commit** `feat: trip preference parsing for onboarding`.

### Task 2: Move planner to `/plan` and honour preferences

**Files:**
- Move: `app/(app)/page.tsx` → `app/plan/page.tsx` (delete the empty `(app)` group)
- Modify: `components/Trip.tsx` (props, initial state, header link), `components/GroupArrival.tsx` and any other `href="/"` "Back to Plan" links (grep `href="/"` and `backToPlan`), `components/QrPage.tsx` (button label target only)
- Create: `app/page.tsx` (temporary redirect-only version, replaced in Task 3)

**Interfaces:**
- Consumes: `parsePrefs`, `Prefs` from Task 1.
- Produces: `Trip` accepts `initial: Prefs`; `/plan` page passes `parsePrefs(query)`; `/` redirects to `/plan` + the same query string when `t` or `route` is present.

- [ ] **Step 1: Move** the page with `git mv`, change nothing else, then run `npm run build` — expect success and `/plan` in the route list.
- [ ] **Step 2: Wire preferences:** `Trip` initial `lang`, `vehicle`, `range` (250 for EV, else 500, as today) and `needs` (object from `Need[]`) come from `initial`. The `/plan` page reads `searchParams`, builds `initial` with `parsePrefs`.
- [ ] **Step 3: Redirect:** in `app/page.tsx` use `redirect()` from `next/navigation` for requests carrying `t` or `route`, preserving all params. Without them it renders a placeholder `<main>` for now.
- [ ] **Step 4: Back links:** in-app "Back to Plan" style links point to `/plan`; add a small header link in the planner masthead back to `/` labelled by a new `home` i18n key.
- [ ] **Step 5: Verify:** `npm test`, `npx tsc --noEmit`; with `npm run dev`, `curl -sI "localhost:3000/?t=1"` shows a redirect to `/plan?t=1`.
- [ ] **Step 6: Commit** `feat: move planner to /plan with preference pre-fill`.

### Task 3: Landing page

**Files:**
- Create: `components/Landing.tsx` (client), `app/landing.css`
- Modify: `app/page.tsx`, `lib/i18n.ts`, `app/layout.tsx` (import `landing.css`)

**Interfaces:**
- Consumes: `getRoute`, `routeLengthKm`, `quoteToll`, `parsePrefs`, `prefsQuery`.
- Produces: `Landing({ km, driveMinutes, tollRm, tester }: { km: number; driveMinutes: number; tollRm: number | null; tester: boolean })`.
- New i18n keys: `landingTitle` ("KL → Ipoh, planned in a minute"), `landingSub`, `planMyDrive`, `landingStepPlan`, `landingStepRoad`, `landingStepGo`, `meetingFriends`, `testerStrip` ("3 quick tasks"), `home`.

- [ ] **Step 1:** `app/page.tsx` server component computes km (`routeLengthKm(line)`), drive minutes (`line.properties.duration_s_freeflow / 60`, fallback `km / 90 * 60`) and toll from the default route, and renders `<Landing …/>`.
- [ ] **Step 2:** `Landing` layout: full-bleed `/kl-ipoh-drive-preview.webp` hero filling the viewport behind a bottom sheet (`--sheet-radius`, `--sheet-shadow`) containing the title, metrics row (distance, drive time, Class 1 toll), a Plan / Road / Go step strip, a full-width primary button, and a "Meeting friends? Group Arrival" link. Top-right EN/BM toggle (`data-testid="btn-lang"` is already used by the planner; use `landing-lang`). Tester strip shown when `tester`.
- [ ] **Step 3:** Primary button target: `/onboarding` + `prefsQuery({ lang })`, or `/plan` + the same when `localStorage["jalan-pulang-onboarded"] === "1"` (read in an effect inside try/catch; default to onboarding). `data-testid="landing-start"`.
- [ ] **Step 4: Verify** at 390×844 in Chrome (scratchpad playwright script): purpose line and button visible without scrolling; toll shows `RM 20.34`; BM toggle changes copy; `npm test`, `npx tsc --noEmit`.
- [ ] **Step 5: Commit** `feat: map-first landing page`.

### Task 4: Onboarding

**Files:**
- Create: `app/onboarding/page.tsx`, `components/Onboarding.tsx` (client)
- Modify: `lib/i18n.ts`, `app/landing.css`

**Interfaces:**
- Consumes: `parsePrefs`, `prefsQuery`, `Prefs`.
- Produces: `Onboarding({ initial }: { initial: Prefs })`. i18n keys: `onbVehicleQ`, `onbNeedsQ`, `onbSkip`, `onbContinue`, `onbFinish`, `onbProgress` ("Step {n} of 2").

- [ ] **Step 1:** Two steps in local state. Step 1: Petrol / EV chips (single select, `aria-pressed`). Step 2: toilet, surau, EV charger, food, fuel chips (multi select). Segmented two-part progress bar, back control, Skip, sticky bottom primary button (44px+).
- [ ] **Step 2:** Finish and Skip set `localStorage["jalan-pulang-onboarded"]="1"` in try/catch, then `window.location.assign("/plan" + prefsQuery(prefs, tester ? { t: "1" } : {}))`. Skip uses defaults (petrol, no needs) but keeps `lang` and `t`. Keep `t` and `route` from the incoming query.
- [ ] **Step 3: Verify:** script: landing → start → pick EV and surau → finish → `/plan` shows EV selected, range 250, surau checked; repeat with Skip; repeat with `localStorage` blocked via an init script that throws.
- [ ] **Step 4: Commit** `feat: skippable two-step onboarding`.

### Task 5: Offline shell, docs, end-to-end check

**Files:**
- Modify: `public/sw.js`, `HANDOVER.md`, `FEATURES.md`, `components/QrPage.tsx` (copy only if needed)

- [ ] **Step 1:** In `sw.js` add `/plan` and `/onboarding` to `shell`, add `/plan` and `/onboarding` to the `navigation` path list, bump `cacheName` to `jalan-pulang-v3`.
- [ ] **Step 2:** Update HANDOVER.md (routes, flow, "Where to make changes") and FEATURES.md (landing and onboarding under Engagement).
- [ ] **Step 3: Full verification:** `npm test`, `npx tsc --noEmit`, `npm run build`; then a scripted 390×844 cold-profile run: `/` → onboarding → `/plan` → Road → Go, `/?t=1` redirect, returning-visitor skip, BM end to end. Save screenshots of each screen to the scratchpad and report results with evidence.
- [ ] **Step 4: Commit** `feat: offline shell and docs for landing flow`.
