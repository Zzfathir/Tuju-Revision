import type { Stop } from "./schemas";

export const CAR_BODIES = ["sedan", "hatchback", "suv"] as const;
export const CAR_PAINTS = ["blue", "red", "white", "black", "yellow", "green"] as const;
export type GarageCar = { body: typeof CAR_BODIES[number]; paint: typeof CAR_PAINTS[number]; trail: boolean; plate?: string };

const QUESTS = [
  { id: "rawang", stopId: "osm-way-307663997", title: "Take a breather at Rawang", category: "Rest", minutes: 8, xp: 80 },
  { id: "tapah", stopId: "osm-way-339101076", title: "Find the surau at R&R Tapah", category: "Explore", minutes: 12, xp: 150 },
] as const;

export type RoadQuest = (typeof QUESTS)[number] & { km: number };
type QuestId = RoadQuest["id"];
export type RoadGame = { active: QuestId | null; done: QuestId[]; car: GarageCar; saved: string[] };
export const ROAD_GAME_KEY = "jalan-pulang-road-game";
const XP_PER_LEVEL = 150;

export function questsForRoute(stops: Pick<Stop, "id" | "distanceAlongRoute_km">[]): RoadQuest[] {
  return QUESTS.flatMap((quest) => {
    const stop = stops.find(({ id }) => id === quest.stopId);
    return stop ? [{ ...quest, km: stop.distanceAlongRoute_km }] : [];
  }).sort((a, b) => a.km - b.km);
}

function isQuestId(value: unknown): value is QuestId {
  return QUESTS.some(({ id }) => id === value);
}

export function parseRoadGame(value: string | null): RoadGame {
  let stored: Partial<RoadGame> | null = null;
  try { stored = JSON.parse(value ?? "null"); } catch { /* reset malformed local data */ }
  const done = Array.isArray(stored?.done) ? [...new Set(stored.done.filter(isQuestId))] : [];
  const active = isQuestId(stored?.active) && !done.includes(stored.active) ? stored.active : null;
  const car = stored?.car;
  return {
    active, done,
    car: {
      body: car && CAR_BODIES.includes(car.body) ? car.body : "sedan",
      paint: car && CAR_PAINTS.includes(car.paint) ? car.paint : "blue",
      trail: car?.trail === true,
      ...(typeof car?.plate === "string" && /^[A-Z0-9 ]{1,10}$/.test(car.plate) ? { plate: car.plate } : {}),
    },
    saved: Array.isArray(stored?.saved) ? [...new Set(stored.saved.filter((id) => typeof id === "string"))] : [],
  };
}

export function gameProgress(game: RoadGame) {
  const xp = QUESTS.reduce((sum, quest) => sum + (game.done.includes(quest.id) ? quest.xp : 0), 0);
  const level = Math.floor(xp / XP_PER_LEVEL) + 1;
  const progress = xp % XP_PER_LEVEL;
  return { xp, level, progress, next: XP_PER_LEVEL - progress, goal: XP_PER_LEVEL, rank: level > 1 ? "Road explorer" : "Road rookie" };
}

export function startQuest(game: RoadGame, quest: RoadQuest): RoadGame {
  return game.done.includes(quest.id) || game.active === quest.id ? game : { ...game, active: quest.id };
}

export function completeQuest(game: RoadGame, quest: RoadQuest, km: number): RoadGame {
  if (game.active !== quest.id || !Number.isFinite(km) || Math.abs(km - quest.km) > 0.5) return game;
  return { ...game, active: null, done: [...game.done, quest.id] };
}
