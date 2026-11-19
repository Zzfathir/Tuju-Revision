import { expect, it } from "vitest";
import { departureOptions, calendarEvent } from "@/lib/departure";

it("uses dated predictions only for the matching route and date", () => {
  const grid = { routeId: "test", date: "2026-11-20", retrieved_at: "2026-11-19", source_url: "https://example.com", grid: [{ depart: "08:30", duration_min: 85 }] };
  expect(departureOptions("test", grid.date, 100, true, grid).slots).toEqual([{ depart: "08:30", duration_min: 85 }]);
  expect(departureOptions("other", grid.date, 100, true, grid).slots).toHaveLength(24);
  expect(departureOptions("test", "2026-11-21", 100, true, grid).slots).toHaveLength(24);
});

it("writes Malaysia departure and arrival as UTC calendar times", () => {
  const result = calendarEvent("A, B", new Date("2026-11-20T01:30:00+08:00"), 120);
  expect(result).toContain("DTSTART:20261119T173000Z");
  expect(result).toContain("DTEND:20261119T193000Z");
  expect(result).toContain("SUMMARY:A\\, B");
});
