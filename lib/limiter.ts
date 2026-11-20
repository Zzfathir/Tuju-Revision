/** Sliding-window call limiter. Per server instance: a cheap, honest cap on metered or fair-use upstreams. */
export function makeLimiter({ max, perMs, now = Date.now }: { max: number; perMs: number; now?: () => number }) {
  const hits: number[] = [];
  const prune = () => { const t = now(); while (hits.length && t - hits[0] >= perMs) hits.shift(); };
  return {
    take(): boolean {
      prune();
      if (hits.length >= max) return false;
      hits.push(now());
      return true;
    },
    retryAfterMs(): number {
      prune();
      return hits.length >= max ? Math.max(0, perMs - (now() - hits[0])) : 0;
    },
  };
}
