/**
 * Cruise state machine. Pure: no React, no map. Only legal transitions happen; an illegal event is ignored.
 *
 * Ruling (see docs/superpowers/plans/2026-11-21-cruise-mode.md): a simulated drive is a position SOURCE, not a
 * state. SIMULATE therefore goes IDLE → ARMED like START, and the same pipeline runs from there, so a simulation
 * can show CRUISING → OFF_ROUTE → CRUISING → ARRIVING as the acceptance criteria require.
 */
export type CruiseState = "IDLE" | "ARMED" | "CRUISING" | "OFF_ROUTE" | "ARRIVING" | "ENDED";
export type CruiseEvent = "START" | "SIMULATE" | "ON_ROUTE" | "OFF" | "NEAR_END" | "EXIT";

export const TRANSITIONS: Record<CruiseState, Partial<Record<CruiseEvent, CruiseState>>> = {
  IDLE: { START: "ARMED", SIMULATE: "ARMED" },
  ARMED: { ON_ROUTE: "CRUISING", EXIT: "ENDED" },
  CRUISING: { OFF: "OFF_ROUTE", NEAR_END: "ARRIVING", EXIT: "ENDED" },
  OFF_ROUTE: { ON_ROUTE: "CRUISING", EXIT: "ENDED" },
  ARRIVING: { EXIT: "ENDED" },
  ENDED: {},
};

export const isLegal = (state: CruiseState, event: CruiseEvent) => TRANSITIONS[state][event] !== undefined;

export function send(state: CruiseState, event: CruiseEvent): CruiseState {
  const next = TRANSITIONS[state][event];
  if (next === undefined) {
    if (process.env.NODE_ENV === "development") console.debug(`[cruise] ignored ${event} in ${state}`);
    return state;
  }
  return next;
}
