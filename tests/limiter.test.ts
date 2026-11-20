import { describe, expect, it } from "vitest";
import { makeLimiter } from "@/lib/limiter";

describe("makeLimiter", () => {
  it("allows up to max calls inside the window, then refuses", () => {
    let now = 0;
    const limiter = makeLimiter({ max: 3, perMs: 1000, now: () => now });
    expect([limiter.take(), limiter.take(), limiter.take(), limiter.take()]).toEqual([true, true, true, false]);
  });

  it("recovers once the window has passed", () => {
    let now = 0;
    const limiter = makeLimiter({ max: 1, perMs: 1000, now: () => now });
    expect(limiter.take()).toBe(true);
    expect(limiter.take()).toBe(false);
    now = 1001;
    expect(limiter.take()).toBe(true);
  });

  it("reports how long to wait when refusing", () => {
    let now = 0;
    const limiter = makeLimiter({ max: 1, perMs: 1000, now: () => now });
    limiter.take();
    now = 400;
    expect(limiter.take()).toBe(false);
    expect(limiter.retryAfterMs()).toBe(600);
  });
});
