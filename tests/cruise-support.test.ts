import { describe, expect, it, vi } from "vitest";
import { zoomForSpeed } from "@/lib/cruise/zoom";
import { createVoice, phrase, pickVoice } from "@/lib/cruise/voice";
import { createWakeLock } from "@/lib/cruise/wakelock";
import type { Utterance } from "@/lib/cruise/lookahead";

const say = (over: Partial<Utterance>): Utterance => ({ id: "x", kind: "toll", name: "Plaza Tol Tapah", level: 2, distKm: 2, facilities: [], planned: false, interrupt: false, ...over });

describe("zoomForSpeed", () => {
  it("is 17 when slow, 15.5 when fast, and linear between", () => {
    expect(zoomForSpeed(0)).toBe(17);
    expect(zoomForSpeed(40)).toBe(17);
    expect(zoomForSpeed(70)).toBeCloseTo(16.25, 5);
    expect(zoomForSpeed(100)).toBe(15.5);
    expect(zoomForSpeed(140)).toBe(15.5);
  });
  it("copes with nonsense input by staying zoomed in", () => {
    expect(zoomForSpeed(NaN)).toBe(17);
    expect(zoomForSpeed(-20)).toBe(17);
  });
});

describe("phrase", () => {
  it("builds short templated lines in English", () => {
    expect(phrase("en", say({ level: 2, distKm: 2 }))).toBe("Toll in 2 km");
    expect(phrase("en", say({ level: 3, distKm: 0.4 }))).toBe("Toll ahead");
  });
  it("says metres, rounded to 100, under a kilometre", () => {
    expect(phrase("en", say({ level: 2, distKm: 0.83 }))).toBe("Toll in 800 m");
  });
  it("names a stop and lists only its confirmed facilities", () => {
    const line = phrase("en", say({ kind: "rnr", name: "Kawasan Rehat Tapah", level: 2, distKm: 1.8, facilities: ["surau", "ev"] }));
    expect(line).toBe("Kawasan Rehat Tapah in 2 km with surau and EV charger");
    expect(phrase("en", say({ kind: "rnr", name: "Tapah", level: 3, facilities: [] }))).toBe("Tapah ahead");
  });
  it("speaks Bahasa Malaysia", () => {
    expect(phrase("bm", say({ level: 2, distKm: 2 }))).toBe("Tol dalam 2 km");
    const stop = phrase("bm", say({ kind: "rnr", name: "R&R Tapah", level: 2, distKm: 2, facilities: ["surau", "ev"] }));
    expect(stop).toContain("dalam 2 km");
    expect(stop).toContain(" dan ");
  });
  it("describes a break point plainly", () => {
    expect(phrase("en", say({ kind: "break", name: "Break 2", level: 3 }))).toBe("Break stop ahead");
  });
});

describe("pickVoice", () => {
  const voices = [{ lang: "en-GB", name: "English" }, { lang: "ms-MY", name: "Malay" }];
  it("prefers a Malay voice for Bahasa Malaysia", () => {
    expect(pickVoice(voices, "bm")).toEqual({ voice: voices[1], fellBack: false });
  });
  it("falls back to English when there is no Malay voice, and says so", () => {
    expect(pickVoice([voices[0]], "bm")).toEqual({ voice: voices[0], fellBack: true });
  });
  it("uses an English voice for English, and nothing when nothing is installed", () => {
    expect(pickVoice(voices, "en")).toEqual({ voice: voices[0], fellBack: false });
    expect(pickVoice([], "en")).toEqual({ voice: null, fellBack: false });
  });
});

function fakeSynth(voices: { lang: string; name: string }[] = [{ lang: "en-US", name: "English" }]) {
  const spoken: string[] = [];
  const synth = {
    speaking: false, pending: false,
    getVoices: () => voices,
    speak: vi.fn((u: { text: string }) => { spoken.push(u.text); synth.speaking = true; }),
    cancel: vi.fn(() => { synth.speaking = false; }),
  };
  const Utter = class { text: string; voice: unknown; lang = ""; rate = 1; constructor(text: string) { this.text = text; } };
  return { synth, Utter, spoken };
}

describe("createVoice", () => {
  it("stays silent until initialised on a user gesture (iOS requirement)", () => {
    const { synth, Utter, spoken } = fakeSynth();
    const voice = createVoice({ synth, Utter } as never);
    expect(voice.speak("Toll ahead", { interrupt: false })).toBe(false);
    expect(spoken).toEqual([]);
    voice.init("en");
    expect(voice.speak("Toll ahead", { interrupt: false })).toBe(true);
    expect(spoken).toEqual(["Toll ahead"]);
  });

  it("does not talk over itself, except for an interrupt, which cancels first", () => {
    const { synth, Utter, spoken } = fakeSynth();
    const voice = createVoice({ synth, Utter } as never);
    voice.init("en");
    voice.speak("first", { interrupt: false });
    expect(voice.speak("second", { interrupt: false })).toBe(false); // still speaking
    expect(voice.speak("urgent", { interrupt: true })).toBe(true);
    expect(synth.cancel).toHaveBeenCalled();
    expect(spoken).toEqual(["first", "urgent"]);
  });

  it("reports when it is muted, unavailable, or using a fallback voice", () => {
    expect(createVoice({ synth: null, Utter: null } as never).init("en")).toEqual({ available: false, fellBack: false });
    const { synth, Utter } = fakeSynth([{ lang: "en-US", name: "English" }]);
    expect(createVoice({ synth, Utter } as never).init("bm")).toEqual({ available: true, fellBack: true });
    const muted = createVoice({ synth, Utter } as never);
    muted.init("en");
    muted.setMuted(true);
    expect(muted.speak("hello", { interrupt: false })).toBe(false);
  });
});

function fakeEnv(supported = true) {
  const listeners: Record<string, () => void> = {};
  const sentinels: { released: boolean; release: () => Promise<void> }[] = [];
  const nav = supported ? { wakeLock: { request: vi.fn(async () => { const s = { released: false, release: async () => { s.released = true; } }; sentinels.push(s); return s; }) } } : {};
  const doc = {
    visibilityState: "visible",
    addEventListener: (name: string, fn: () => void) => { listeners[name] = fn; },
    removeEventListener: (name: string) => { delete listeners[name]; },
  };
  return { nav, doc, listeners, sentinels };
}

describe("createWakeLock", () => {
  it("holds the screen awake when the browser allows it", async () => {
    const env = fakeEnv();
    const lock = createWakeLock(env.nav as never, env.doc as never);
    expect(await lock.request()).toBe("active");
    expect(env.sentinels).toHaveLength(1);
  });
  it("reports unsupported browsers without throwing", async () => {
    const env = fakeEnv(false);
    expect(await createWakeLock(env.nav as never, env.doc as never).request()).toBe("unsupported");
  });
  it("reports a refusal as denied", async () => {
    const env = fakeEnv();
    (env.nav as { wakeLock: { request: () => Promise<unknown> } }).wakeLock.request = async () => { throw new Error("denied"); };
    expect(await createWakeLock(env.nav as never, env.doc as never).request()).toBe("denied");
  });
  it("asks again when the page becomes visible after the lock was dropped", async () => {
    const env = fakeEnv();
    const lock = createWakeLock(env.nav as never, env.doc as never);
    await lock.request();
    env.sentinels[0].released = true; // the browser released it while the tab was hidden
    env.listeners.visibilitychange?.();
    await Promise.resolve(); await Promise.resolve();
    expect(env.sentinels).toHaveLength(2);
  });
  it("release stops it for good", async () => {
    const env = fakeEnv();
    const lock = createWakeLock(env.nav as never, env.doc as never);
    await lock.request();
    await lock.release();
    expect(env.sentinels[0].released).toBe(true);
    expect(env.listeners.visibilitychange).toBeUndefined();
  });
});
