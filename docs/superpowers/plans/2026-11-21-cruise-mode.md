# Cruise mode implementation plan

**Spec:** `CRUISE_MODE_SPEC.md` (user-supplied). Builds on the user's existing `DriveHud`, `lib/drive-camera.ts`, `lib/drive-progress.ts`, `public/drive-car.svg` and `RouteMap` drive camera. Reference image: Amap Car Cruise (route ribbon ahead of the car, heading-up, car low on screen).

## Rulings (decided, with cost if wrong)
1. **Simulation is a position source, not a state.** The spec's table gives `SIM` only an `EXIT` edge, yet its acceptance criteria require a simulated drive to show CRUISING → OFF_ROUTE → CRUISING → ARRIVING. The spec's own text says SIM and CRUISING "share all downstream logic; only the position source differs". So `SIMULATE` from IDLE goes to ARMED with `source: "sim"`, and every other transition is as specified. Cost if wrong: one extra table row to change.
2. **Simulated time is faster than real time.** A real 193 km drive is ~2 h. The simulator emits true 1 Hz fixes (so EMA, 10 s off-route and 8 s cooldown rules behave exactly as on a phone) but advances them in bursts, by default 60× real time, so a demo takes about two minutes.
3. **Thresholds** live in `lib/cruise/config.ts`, unvalidated starting values exactly as in the spec.
4. **Event relevance:** tolls always alert; an R&R alerts if it is planned or satisfies a selected need (spec section 6).
5. **No speed-limit badge.** We hold no verified limit data (spec 14.3), so only speed is shown.
6. **Voice** uses the browser's `speechSynthesis`, initialised on the Start tap, English fallback if no Bahasa Malaysia voice, banners always shown.

## Tasks (each: failing test first, then code)
1. `lib/cruise/machine.ts` + `config.ts` — transitions, illegal events ignored.
2. `lib/cruise/pipeline.ts` — accuracy filter, EMA smoothing, snap to route (km along, distance off, route bearing).
3. `lib/cruise/intent.ts` — enter CRUISING (5 good fixes + heading), OFF_ROUTE (>120 m for 10 s), recovery (3 fixes), NEAR_END.
4. `lib/cruise/lookahead.ts` — L1/L2/L3 once per level per event, cooldown, interrupt, suppression, minimum-speed ETA.
5. `lib/cruise/simulator.ts` — 1 Hz fixes, speed profile, slow zones at tolls, injectable detour.
6. `lib/cruise/engine.ts` — composes 1–5; end-to-end test of the full state sequence.
7. `lib/cruise/voice.ts`, `wakelock.ts`, `zoom.ts` — phrases, graceful fallbacks, speed-based zoom.
8. UI: `useCruise` hook, `CruiseHud` (banner, chips, cards, strip, controls), `GoCards` and `RouteMap` integration (heading-up toggle, ribbon, camera follow), EN and BM copy.
9. Browser checks on a phone viewport: simulate drive end to end, detour, mute, exit confirm, arrived screen.

## Cut list if time runs short (spec section 10)
Ribbon animation, day/night, heading toggle, voice, real GPS. Simulate Drive is the demo-safe path and stays.
