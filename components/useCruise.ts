"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createCruise, type CruiseSnapshot } from "@/lib/cruise/engine";
import type { RouteEvent, VoiceLevel } from "@/lib/cruise/lookahead";
import type { Fix } from "@/lib/cruise/pipeline";
import { createSimulator } from "@/lib/cruise/simulator";
import { createVoice, phrase } from "@/lib/cruise/voice";
import { createWakeLock, type WakeStatus } from "@/lib/cruise/wakelock";
import type { DriveFrame, DrivePose } from "@/lib/drive-camera";
import type { Lang } from "@/lib/i18n";
import type { RouteLine } from "@/lib/route";

/** The simulator plays this many times faster than real time, so a 193 km demo drive takes about two minutes. */
const SIM_SPEEDUP = 60;
const SIM_TICK_MS = 250;

type Options = {
  line: RouteLine; routeKm: number; events: RouteEvent[]; slowZonesKm: number[]; lang: Lang;
  onFrame: (frame: DriveFrame | null) => void;
  /** The drive reached its destination (the user still taps Finish). */
  onArrived: () => void;
  onEnded: () => void;
};

/**
 * Connects the pure cruise engine to the real world: the phone's GPS or the simulator, voice, the wake lock and the map.
 * Location is read in the browser and never leaves it.
 */
export function useCruise(options: Options) {
  const opts = useRef(options);
  opts.current = options;

  const engine = useRef<ReturnType<typeof createCruise> | null>(null);
  const simulator = useRef<ReturnType<typeof createSimulator> | null>(null);
  const timer = useRef<number | null>(null);
  const watch = useRef<number | null>(null);
  const clockBase = useRef(0);
  const arrivedSent = useRef(false);
  const voice = useRef<ReturnType<typeof createVoice> | null>(null);
  const wake = useRef<ReturnType<typeof createWakeLock> | null>(null);

  const [snapshot, setSnapshot] = useState<CruiseSnapshot | null>(null);
  const [muted, setMutedState] = useState(false);
  const [voiceLevel, setVoiceLevelState] = useState<VoiceLevel>("normal");
  const [headingUp, setHeadingUp] = useState(true);
  const [wakeStatus, setWakeStatus] = useState<WakeStatus>("idle");
  const [voiceInfo, setVoiceInfo] = useState({ available: true, fellBack: false });
  const [gpsError, setGpsError] = useState(false);
  /** The GPS stopped reporting (tunnel, weak signal). Transient: the drive carries on and recovers by itself. */
  const [gpsLost, setGpsLost] = useState(false);
  const controls = useRef({ voice: "normal" as VoiceLevel, muted: false });

  const publish = useCallback((next: CruiseSnapshot, replay?: DriveFrame["replay"]) => {
    setSnapshot(next);
    if (next.point) {
      opts.current.onFrame({ point: next.point, course: next.course, fraction: next.fraction, speedKmh: next.speedKmh, replay });
    }
    if (next.speak) {
      voice.current?.speak(phrase(opts.current.lang, next.speak), { interrupt: next.speak.interrupt });
    }
    if (next.arrived && !arrivedSent.current) { arrivedSent.current = true; opts.current.onArrived(); }
  }, []);

  const stopSources = useCallback(() => {
    if (timer.current !== null) { window.clearInterval(timer.current); timer.current = null; }
    if (watch.current !== null) { navigator.geolocation?.clearWatch(watch.current); watch.current = null; }
  }, []);

  const exit = useCallback(() => {
    stopSources();
    voice.current?.cancel();
    void wake.current?.release();
    const final = engine.current?.exit();
    engine.current = null;
    simulator.current = null;
    arrivedSent.current = false;
    setWakeStatus("idle");
    if (final) setSnapshot(final);
    opts.current.onFrame(null);
    opts.current.onEnded();
  }, [stopSources]);

  /** Must be called from a tap: speech and the wake lock both need a user gesture on iOS. */
  const begin = useCallback((source: "gps" | "sim") => {
    stopSources();
    const { line, routeKm, events, slowZonesKm, lang } = opts.current;
    const cruise = createCruise({ line, routeKm, events });
    engine.current = cruise;
    arrivedSent.current = false;
    setGpsError(false);
    setGpsLost(false);

    voice.current = voice.current ?? createVoice();
    voice.current.setMuted(controls.current.muted);
    setVoiceInfo(voice.current.init(lang));
    wake.current = wake.current ?? createWakeLock();
    void wake.current.request().then(setWakeStatus);

    if (source === "sim") {
      cruise.simulate();
      const sim = createSimulator(line, routeKm, { slowZonesKm });
      simulator.current = sim;
      clockBase.current = Date.now();
      let previousPose: DrivePose | undefined;
      publish(cruise.snapshot());
      timer.current = window.setInterval(() => {
        const current = engine.current;
        if (!current) return;
        const burst = sim.tick(Math.round((SIM_SPEEDUP * SIM_TICK_MS) / 1000));
        let last = current.snapshot();
        const poses: DrivePose[] = previousPose ? [previousPose] : [];
        const reached: CruiseSnapshot["reached"] = [];
        let speak: CruiseSnapshot["speak"] = null;
        for (const fix of burst) {
          last = current.push({ ...fix, t: fix.t + clockBase.current }, controls.current);
          // Draw the simulated path itself so changing the route-match state cannot teleport the car.
          previousPose = { point: [fix.lng, fix.lat], course: fix.heading, speedKmh: last.speedKmh };
          poses.push(previousPose);
          reached.push(...last.reached);
          // Fast-forwarding produces many lines at once; keep the most urgent.
          if (last.speak && (!speak || last.speak.level > speak.level)) speak = last.speak;
        }
        if (burst.length) {
          // Play the fixes over the next tick while the HUD keeps its existing update cadence.
          publish({ ...last, reached, speak }, { startedAt: performance.now(), sampleMs: 1000 / SIM_SPEEDUP, poses });
        }
        if (sim.done() && last.arrived && timer.current !== null) { window.clearInterval(timer.current); timer.current = null; }
      }, SIM_TICK_MS);
      return;
    }

    cruise.start();
    publish(cruise.snapshot());
    if (!navigator.geolocation) { setGpsError(true); exit(); return; }
    watch.current = navigator.geolocation.watchPosition(({ coords, timestamp }) => {
      const fix: Fix = {
        t: timestamp, lat: coords.latitude, lng: coords.longitude,
        speed: coords.speed, heading: coords.heading !== null && Number.isFinite(coords.heading) ? coords.heading : null,
        accuracy: coords.accuracy,
      };
      setGpsLost(false);
      const next = engine.current?.push(fix, controls.current);
      if (next) publish(next);
    }, (error) => {
      // Only a refusal ends the drive. A timeout or a lost signal is normal in a car, so say so and keep listening.
      if (error.code === 1) { setGpsError(true); exit(); } else setGpsLost(true);
    }, { enableHighAccuracy: true, maximumAge: 2000 });
  }, [exit, publish, stopSources]);

  useEffect(() => () => {
    stopSources();
    voice.current?.cancel();
    void wake.current?.release();
  }, [stopSources]);

  return {
    snapshot, muted, voiceLevel, headingUp, wakeStatus, voiceInfo, gpsError, gpsLost,
    startGps: () => begin("gps"),
    startSim: () => begin("sim"),
    exit,
    injectDetour: () => simulator.current?.injectDetour({ lengthKm: 1.5, offsetM: 400 }),
    setHeadingUp,
    setMuted(value: boolean) { controls.current.muted = value; voice.current?.setMuted(value); setMutedState(value); },
    setVoiceLevel(value: VoiceLevel) { controls.current.voice = value; setVoiceLevelState(value); },
  };
}
