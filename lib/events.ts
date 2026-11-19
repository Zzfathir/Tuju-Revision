import type { EventName } from "@/lib/counter";

export async function sendEvent(event: EventName) {
  let sid: string | undefined;
  try {
    sid = sessionStorage.getItem("jalan-pulang-session") ?? crypto.randomUUID().replaceAll("-", "");
    sessionStorage.setItem("jalan-pulang-session", sid);
  } catch { /* session storage may be unavailable */ }
  const response = await fetch("/api/event", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event, sid }), keepalive: true,
  }).catch(() => null);
  return Boolean(response?.ok);
}

export function track(event: EventName) {
  void sendEvent(event);
}
