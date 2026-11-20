import { t, type Key, type Lang } from "../i18n";
import type { Utterance } from "./lookahead";

const FACILITY_LABEL: Record<string, Key> = { surau: "surau", toilet: "toilet", fuel: "fuel", ev: "evCharger", food: "food", atm: "atm" };

// "Surau" reads as "surau" mid-sentence; acronyms such as "EV charger" and "ATM" keep their capitals.
const midSentence = (word: string) => (/^[A-Z][a-z]/.test(word) ? word[0].toLowerCase() + word.slice(1) : word);

function distance(lang: Lang, km: number) {
  if (km >= 1) return t(lang, "cruiseKm", { n: Math.round(km) });
  return t(lang, "cruiseMetres", { n: Math.max(100, Math.round(km * 10) * 100) });
}

/** A short, templated spoken line. Lines are kept short on purpose: nobody wants a paragraph at 100 km/h. */
export function phrase(lang: Lang, u: Pick<Utterance, "kind" | "name" | "level" | "distKm" | "facilities">): string {
  const d = distance(lang, u.distKm);
  if (u.kind === "toll") return t(lang, u.level === 3 ? "cruiseTollL3" : "cruiseTollL2", { d });
  if (u.kind === "break") return t(lang, u.level === 3 ? "cruiseBreakL3" : "cruiseBreakL2", { d });
  const names = u.facilities.filter((key) => FACILITY_LABEL[key]).map((key) => midSentence(t(lang, FACILITY_LABEL[key])));
  const list = names.length > 1 ? names.slice(0, -1).join(", ") + " " + t(lang, "cruiseAnd") + " " + names.at(-1) : names[0];
  const withList = list ? t(lang, "cruiseWith", { list }) : "";
  return t(lang, u.level === 3 ? "cruiseStopL3" : "cruiseStopL2", { name: u.name, d, with: withList });
}

type VoiceLike = { lang: string; name: string };

/** Prefer a Malay voice for Bahasa Malaysia, otherwise English. `fellBack` is true when Malay was wanted but missing. */
export function pickVoice<V extends VoiceLike>(voices: V[], lang: Lang): { voice: V | null; fellBack: boolean } {
  const english = voices.find((v) => /^en\b/i.test(v.lang)) ?? null;
  if (lang === "bm") {
    const malay = voices.find((v) => /^ms\b/i.test(v.lang));
    if (malay) return { voice: malay, fellBack: false };
    return { voice: english, fellBack: english !== null };
  }
  return { voice: english ?? null, fellBack: false };
}

type Synth = {
  speaking: boolean; getVoices: () => VoiceLike[]; speak: (u: unknown) => void; cancel: () => void;
};
type UtterCtor = new (text: string) => { text: string; voice: unknown; lang: string; rate: number };

/**
 * Speech through the browser's built-in voice. Nothing is sent anywhere. `init` must run on a user gesture (iOS refuses
 * the first utterance otherwise), so call it from the Start tap. Always safe to call: it degrades to silence.
 */
export function createVoice(env?: { synth: Synth | null; Utter: UtterCtor | null }) {
  const synth = env ? env.synth : typeof window !== "undefined" && "speechSynthesis" in window ? (window.speechSynthesis as unknown as Synth) : null;
  const Utter = env ? env.Utter : typeof window !== "undefined" ? (window.SpeechSynthesisUtterance as unknown as UtterCtor) : null;
  let ready = false;
  let muted = false;
  let chosen: VoiceLike | null = null;
  let langTag = "en";

  return {
    init(lang: Lang): { available: boolean; fellBack: boolean } {
      if (!synth || !Utter) return { available: false, fellBack: false };
      const picked = pickVoice(synth.getVoices(), lang);
      chosen = picked.voice;
      langTag = lang === "bm" && !picked.fellBack ? "ms-MY" : "en-GB";
      ready = true;
      return { available: true, fellBack: picked.fellBack };
    },
    setMuted(value: boolean) { muted = value; if (value) synth?.cancel(); },
    /** Returns whether the line was handed to the speech engine. */
    speak(text: string, { interrupt }: { interrupt: boolean }): boolean {
      if (!ready || muted || !synth || !Utter) return false;
      if (synth.speaking) {
        if (!interrupt) return false;
        synth.cancel();
      }
      const utterance = new Utter(text);
      utterance.voice = chosen;
      utterance.lang = chosen?.lang ?? langTag;
      utterance.rate = 1;
      synth.speak(utterance);
      return true;
    },
    cancel() { synth?.cancel(); },
  };
}
