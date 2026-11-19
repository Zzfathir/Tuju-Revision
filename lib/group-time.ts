const offset = 8 * 3600_000;

export function myTimeInput(timestamp: number) {
  return new Date(timestamp + offset).toISOString().slice(0, 16);
}

export function parseMyTime(text: string) {
  return Date.parse(text + ":00+08:00");
}

export function groupTime(timestamp: number, locale: "en" | "bm", withDate = false) {
  return new Intl.DateTimeFormat(locale === "bm" ? "ms-MY" : "en-MY", {
    timeZone: "Asia/Kuala_Lumpur", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    ...(withDate ? { day: "numeric", month: "short" } : {}),
  }).format(timestamp);
}
