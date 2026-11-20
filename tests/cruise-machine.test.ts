import { describe, expect, it } from "vitest";
import { isLegal, send, TRANSITIONS, type CruiseEvent, type CruiseState } from "@/lib/cruise/machine";
import { cruiseConfig } from "@/lib/cruise/config";

const STATES: CruiseState[] = ["IDLE", "ARMED", "CRUISING", "OFF_ROUTE", "ARRIVING", "ENDED"];
const EVENTS: CruiseEvent[] = ["START", "SIMULATE", "ON_ROUTE", "OFF", "NEAR_END", "EXIT"];

describe("cruise state machine", () => {
  it("makes exactly the specified legal transitions", () => {
    const legal: [CruiseState, CruiseEvent, CruiseState][] = [
      ["IDLE", "START", "ARMED"], ["IDLE", "SIMULATE", "ARMED"],
      ["ARMED", "ON_ROUTE", "CRUISING"], ["ARMED", "EXIT", "ENDED"],
      ["CRUISING", "OFF", "OFF_ROUTE"], ["CRUISING", "NEAR_END", "ARRIVING"], ["CRUISING", "EXIT", "ENDED"],
      ["OFF_ROUTE", "ON_ROUTE", "CRUISING"], ["OFF_ROUTE", "EXIT", "ENDED"],
      ["ARRIVING", "EXIT", "ENDED"],
    ];
    for (const [from, event, to] of legal) {
      expect(isLegal(from, event), `${from} ${event}`).toBe(true);
      expect(send(from, event), `${from} ${event}`).toBe(to);
    }
  });

  it("ignores every illegal event: the state is unchanged", () => {
    let illegal = 0;
    for (const state of STATES) for (const event of EVENTS) {
      if (isLegal(state, event)) continue;
      illegal++;
      expect(send(state, event), `${state} ${event}`).toBe(state);
    }
    expect(illegal).toBeGreaterThan(20);
  });

  it("ENDED is final: nothing leaves it, and START cannot restart a finished drive", () => {
    for (const event of EVENTS) expect(send("ENDED", event)).toBe("ENDED");
    expect(TRANSITIONS.ENDED).toEqual({});
  });

  it("motion alone never arms cruise: only START or SIMULATE leave IDLE", () => {
    for (const event of EVENTS) {
      if (event !== "START" && event !== "SIMULATE") expect(send("IDLE", event)).toBe("IDLE");
    }
  });
});

describe("cruise thresholds (starting values from the spec, to be tuned on a real drive)", () => {
  it("match the specification table", () => {
    expect(cruiseConfig.maxAccuracyM).toBe(50);
    expect(cruiseConfig.posAlpha).toBe(0.4);
    expect(cruiseConfig.speedAlpha).toBe(0.3);
    expect(cruiseConfig.enterFixes).toBe(5);
    expect(cruiseConfig.enterOffM).toBe(60);
    expect(cruiseConfig.enterHeadingDeg).toBe(30);
    expect(cruiseConfig.offRouteM).toBe(120);
    expect(cruiseConfig.offRouteSeconds).toBe(10);
    expect(cruiseConfig.returnFixes).toBe(3);
    expect(cruiseConfig.returnOffM).toBe(60);
    expect(cruiseConfig.arrivingKm).toBe(2);
    expect(cruiseConfig.minEtaSpeed).toBe(5);
    expect(cruiseConfig.alerts).toEqual({ l1Km: 5, l2Km: 2, l3Km: 0.5, l3EtaS: 30 });
    expect(cruiseConfig.voiceCooldownS).toBe(8);
    expect(cruiseConfig.cardSuppressKmh).toBe(110);
  });
});
