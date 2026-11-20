import { describe, expect, it } from "vitest";
import { getRoute } from "@/lib/data";
import { routeLengthKm } from "@/lib/route";
import { bearingBetween, driveCamera, driveCourse } from "@/lib/drive-camera";

const { line } = getRoute("kl-ipoh");
const total = routeLengthKm(line);

describe("bearingBetween", () => {
  it("points north, east, south and west", () => {
    expect(bearingBetween([101, 3], [101, 4])).toBeCloseTo(0, 5);
    expect(bearingBetween([101, 3], [102, 3])).toBeCloseTo(90, 1);
    expect(Math.abs(bearingBetween([101, 3], [101, 2]))).toBeCloseTo(180, 5);
    expect(bearingBetween([101, 3], [100, 3])).toBeCloseTo(-90, 1);
  });

  it("allows for longitude shrinking with latitude (a degree of longitude is shorter away from the equator)", () => {
    const nearEquator = bearingBetween([101, 0], [101.1, 0.1]);
    const farther = bearingBetween([101, 60], [101.1, 60.1]);
    expect(nearEquator).toBeGreaterThan(farther);
  });
});

describe("driveCourse", () => {
  it("follows the route's own direction when there is no GPS", () => {
    const course = driveCourse(line, 60, total)!;
    expect(course).toBeGreaterThan(-90); // the NSE heads north-north-west from KL
    expect(course).toBeLessThan(15);
  });

  it("trusts the GPS heading when the car is actually moving", () => {
    expect(driveCourse(line, 60, total, { heading: 123, speed: 20, onRoute: true })).toBe(123);
  });

  it("ignores a GPS heading when nearly stationary, because it is noise", () => {
    const course = driveCourse(line, 60, total, { heading: 123, speed: 0.5, onRoute: true })!;
    expect(course).not.toBe(123);
    expect(course).toBeCloseTo(driveCourse(line, 60, total)!, 5);
  });

  it("has no course when off the route with no usable GPS heading", () => {
    expect(driveCourse(line, 60, total, { heading: null, speed: 0, onRoute: false })).toBeNull();
    expect(driveCourse(line, 60, total, { heading: 200, speed: 20, onRoute: false })).toBe(200);
  });

  it("stays defined at both ends of the route", () => {
    expect(Number.isFinite(driveCourse(line, 0, total)!)).toBe(true);
    expect(Number.isFinite(driveCourse(line, total, total)!)).toBe(true);
  });
});

describe("driveCamera", () => {
  it("heading-up in perspective: turns with the car, tilted, car sitting low", () => {
    const camera = driveCamera(true, 120, 800);
    expect(camera.bearing).toBe(120);
    expect(camera.pitch).toBe(54);
    expect(camera.offset[1]).toBeGreaterThan(0);
  });

  it("north-up keeps the map facing north but can stay tilted", () => {
    const camera = driveCamera(true, 120, 800, false);
    expect(camera.bearing).toBe(0);
    expect(camera.pitch).toBe(54);
  });

  it("flat 2D is always north-up and untilted, whatever the heading setting", () => {
    expect(driveCamera(false, 120, 800)).toMatchObject({ bearing: 0, pitch: 0, offset: [0, 0] });
    expect(driveCamera(false, 120, 800, true)).toMatchObject({ bearing: 0, pitch: 0 });
  });

  it("falls back to north when the course is unknown", () => {
    expect(driveCamera(true, null, 800).bearing).toBe(0);
  });

  it("never pushes the car further down than 84 px", () => {
    expect(driveCamera(true, 0, 2000).offset[1]).toBe(84);
  });
});
