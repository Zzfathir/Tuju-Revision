/** Map zoom for a given speed: close in when slow (17 under 40 km/h), further out when fast (15.5 over 100 km/h), linear between. */
export function zoomForSpeed(kmh: number): number {
  const slow = 40, fast = 100, near = 17, far = 15.5;
  if (!Number.isFinite(kmh) || kmh <= slow) return near;
  if (kmh >= fast) return far;
  return near + ((kmh - slow) / (fast - slow)) * (far - near);
}
