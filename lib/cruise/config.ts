/**
 * Every cruise threshold in one place. These are STARTING VALUES from CRUISE_MODE_SPEC.md, not validated on a real
 * drive. Tune them here after testing in a car.
 */
export interface CruiseConfig {
  maxAccuracyM: number; posAlpha: number; speedAlpha: number;
  enterFixes: number; enterOffM: number; enterHeadingDeg: number; headingMinSpeed: number;
  offRouteM: number; offRouteSeconds: number; returnFixes: number; returnOffM: number;
  arrivingKm: number; minEtaSpeed: number;
  alerts: { l1Km: number; l2Km: number; l3Km: number; l3EtaS: number };
  voiceCooldownS: number; cardSuppressKmh: number; cardDismissMs: number; l3HoldMs: number;
}

export const cruiseConfig: CruiseConfig = {
  /** Discard a GPS fix less accurate than this (metres). */
  maxAccuracyM: 50,
  /** Exponential moving average weights for position and speed. */
  posAlpha: 0.4,
  speedAlpha: 0.3,

  /** Enter CRUISING after this many consecutive good fixes, each within `enterOffM` of the route. */
  enterFixes: 5,
  enterOffM: 60,
  /** Heading must be within this many degrees of the route bearing (ignored below `headingMinSpeed` m/s). */
  enterHeadingDeg: 30,
  headingMinSpeed: 2,

  /** Go OFF_ROUTE when further than `offRouteM` for `offRouteSeconds`. Return after `returnFixes` fixes within `returnOffM`. */
  offRouteM: 120,
  offRouteSeconds: 10,
  returnFixes: 3,
  returnOffM: 60,

  /** ARRIVING when this little route remains (km). */
  arrivingKm: 2,
  /** Time-to-event never divides by less than this speed (m/s). */
  minEtaSpeed: 5,

  /** Look-ahead alert distances (km) and the L3 time trigger (seconds). */
  alerts: { l1Km: 5, l2Km: 2, l3Km: 0.5, l3EtaS: 30 },
  /** At most one voice line per this many seconds; L3 may interrupt L1 and L2. */
  voiceCooldownS: 8,
  /** Above this speed (km/h) cards are suppressed and only the banner and voice remain. */
  cardSuppressKmh: 110,
  /** L2 cards dismiss themselves after this long; L3 banners stay until passed or this long. */
  cardDismissMs: 9000,
  l3HoldMs: 15000,
};
