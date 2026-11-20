import { describe, expect, it } from "vitest";
import { completeQuest, gameProgress, parseRoadGame, questsForRoute, startQuest } from "../lib/road-game";

const stop = (id: string, distanceAlongRoute_km: number) => ({ id, distanceAlongRoute_km });

describe("road quests", () => {
  it("only offers quests whose stops are on this route, in driving order", () => {
    expect(questsForRoute([stop("osm-way-339101076", 150), stop("unknown", 13), stop("osm-way-307663997", 25)])
      .map(({ id, km }) => [id, km])).toEqual([["rawang", 25], ["tapah", 150]]);
  });

  it("awards XP once when the active quest is reached on the route", () => {
    const [quest] = questsForRoute([stop("osm-way-339101076", 150)]);
    const active = startQuest(parseRoadGame(null), quest);
    expect(completeQuest(active, quest, 145)).toBe(active);
    const completed = completeQuest(active, quest, 150.1);
    expect(completed.active).toBeNull();
    expect(gameProgress(completed).xp).toBe(150);
    expect(completeQuest(completed, quest, 151)).toBe(completed);
    expect(startQuest(completed, quest)).toBe(completed);
  });

  it("keeps valid saved settings and deduplicates old quest completions", () => {
    const restored = parseRoadGame('{"active":"invalid","done":["tapah","tapah","bad"],"car":{"body":"suv","paint":"blue","trail":true}}');
    expect(restored.active).toBeNull();
    expect(restored.done).toEqual(["tapah"]);
    expect(restored.car).toEqual({ body: "suv", paint: "blue", trail: true });
    expect(parseRoadGame("invalid").done).toEqual([]);
  });
});
