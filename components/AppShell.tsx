"use client";

import { useEffect } from "react";

export function AppShell() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    const warm = (worker: ServiceWorker) => worker.postMessage({
      type: "CACHE_ASSETS",
      urls: performance.getEntriesByType("resource").map((entry) => entry.name),
    });
    void navigator.serviceWorker.register("/sw.js").then(async () => {
      const { active } = await navigator.serviceWorker.ready;
      if (active) warm(active);
    }).catch(() => {});
  }, []);
  return null;
}
