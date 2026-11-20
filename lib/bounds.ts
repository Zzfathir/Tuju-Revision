// Malaysia (peninsula, Sabah and Sarawak) with a little margin. Anything outside is not our journey.
export const MALAYSIA_BOUNDS = { minLat: 0.8, maxLat: 7.5, minLng: 99.4, maxLng: 119.5 };

export function inMalaysia(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng)
    && lat >= MALAYSIA_BOUNDS.minLat && lat <= MALAYSIA_BOUNDS.maxLat
    && lng >= MALAYSIA_BOUNDS.minLng && lng <= MALAYSIA_BOUNDS.maxLng;
}
