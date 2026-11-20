"use client";

import { useState } from "react";
import { t } from "@/lib/i18n";
import { prefsQuery, type Prefs } from "@/lib/onboarding";
import type { Need } from "@/lib/planner";

const needsList: Need[] = ["toilet", "surau", "ev", "food", "fuel"];

export function Onboarding({ initial, tester }: { initial: Prefs; tester: boolean }) {
  const { lang } = initial;
  const [step, setStep] = useState<1 | 2>(1);
  const [vehicle, setVehicle] = useState<Prefs["vehicle"]>(initial.vehicle);
  const [needs, setNeeds] = useState<Need[]>(initial.needs);
  const extra: Record<string, string> = tester ? { t: "1" } : {};

  const go = (prefs: Prefs) => {
    try { localStorage.setItem("jalan-pulang-onboarded", "1"); } catch { /* storage may be blocked */ }
    window.location.assign("/plan" + prefsQuery(prefs, extra));
  };
  const back = () => step === 2 ? setStep(1) : window.location.assign("/" + prefsQuery(initial, { ...extra, home: "1" }));
  const next = () => step === 1 ? setStep(2) : go({ lang, vehicle, needs });
  const toggle = (need: Need) => setNeeds((old) => old.includes(need) ? old.filter((item) => item !== need) : [...old, need]);

  return <main className="onboarding" lang={lang} data-testid="screen-onboarding">
    <header className="onb-top">
      <button type="button" className="btn onb-icon" data-testid="onb-back" aria-label={t(lang, "back")} onClick={back}>←</button>
      <div className="onb-progress" role="img" aria-label={t(lang, "onbProgress", { n: step })}>
        <span data-on="true" /><span data-on={String(step === 2)} />
      </div>
      <button type="button" className="btn onb-skip" data-testid="onb-skip" onClick={() => go({ lang, vehicle: "petrol", needs: [] })}>{t(lang, "onbSkip")}</button>
    </header>
    <section className="onb-body">
      <p className="onb-step">{t(lang, "onbProgress", { n: step })}</p>
      {step === 1 ? <>
        <h1>{t(lang, "onbVehicleQ")}</h1>
        <div className="chips" role="group" aria-label={t(lang, "onbVehicleQ")}>
          {(["petrol", "ev"] as const).map((option) => <button type="button" key={option} className="chip" data-testid={"onb-vehicle-" + option}
            aria-pressed={vehicle === option} onClick={() => setVehicle(option)}>{t(lang, option)}</button>)}
        </div>
      </> : <>
        <h1>{t(lang, "onbNeedsQ")}</h1>
        <div className="chips" role="group" aria-label={t(lang, "onbNeedsQ")}>
          {needsList.map((need) => <button type="button" key={need} className="chip" data-testid={"onb-need-" + need}
            aria-pressed={needs.includes(need)} onClick={() => toggle(need)}>{t(lang, need === "ev" ? "evCharger" : need)}</button>)}
        </div>
      </>}
    </section>
    <footer className="onb-bar">
      <button type="button" className="btn landing-cta" data-variant="primary" data-testid="onb-next" onClick={next}>
        {t(lang, step === 1 ? "onbContinue" : "onbFinish")} <span aria-hidden="true">→</span>
      </button>
    </footer>
  </main>;
}
