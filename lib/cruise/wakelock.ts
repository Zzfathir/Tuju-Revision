export type WakeStatus = "idle" | "active" | "unsupported" | "denied";

type Sentinel = { released: boolean; release: () => Promise<void> };
type Nav = { wakeLock?: { request: (type: "screen") => Promise<Sentinel> } };
type Doc = { visibilityState: string; addEventListener: (name: string, fn: () => void) => void; removeEventListener: (name: string, fn: () => void) => void };

/**
 * Keeps the screen on while cruising. Browsers drop the lock when the tab is hidden, so it is asked for again when
 * the page becomes visible. Support varies (installed iOS home-screen apps are unreliable), so the caller shows a
 * visible banner when the status is not "active". Never throws.
 */
export function createWakeLock(nav?: Nav, doc?: Doc) {
  const navigatorLike = nav ?? (typeof navigator !== "undefined" ? (navigator as unknown as Nav) : {});
  const documentLike = doc ?? (typeof document !== "undefined" ? (document as unknown as Doc) : null);
  let sentinel: Sentinel | null = null;
  let wanted = false;
  let status: WakeStatus = "idle";

  const acquire = async (): Promise<WakeStatus> => {
    if (!navigatorLike.wakeLock) return (status = "unsupported");
    try {
      sentinel = await navigatorLike.wakeLock.request("screen");
      return (status = "active");
    } catch {
      return (status = "denied");
    }
  };
  const onVisible = () => {
    if (wanted && documentLike?.visibilityState === "visible" && (!sentinel || sentinel.released)) void acquire();
  };

  return {
    async request(): Promise<WakeStatus> {
      wanted = true;
      documentLike?.addEventListener("visibilitychange", onVisible);
      return acquire();
    },
    async release(): Promise<void> {
      wanted = false;
      documentLike?.removeEventListener("visibilitychange", onVisible);
      try { await sentinel?.release(); } catch { /* already released */ }
      sentinel = null;
      status = "idle";
    },
    status: () => status,
  };
}
