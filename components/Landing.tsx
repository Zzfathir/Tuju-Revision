"use client";

import { useEffect, useState } from "react";
import { fmtDur, t, type Lang } from "@/lib/i18n";
import { groupCopy } from "@/lib/group-copy";
import { prefsQuery } from "@/lib/onboarding";

const steps = [["stepPlan", "landingStepPlan"], ["stepRoad", "landingStepRoad"], ["stepGo", "landingStepGo"]] as const;

export function Landing({ km, driveMinutes, tollRm, tester, initialLang }: {
  km: number; driveMinutes: number; tollRm: number | null; tester: boolean; initialLang: Lang;
}) {
  const [lang, setLang] = useState<Lang>(initialLang);
  const [returning, setReturning] = useState(false);
  useEffect(() => {
    try { setReturning(localStorage.getItem("jalan-pulang-onboarded") === "1"); }
    catch { /* storage may be blocked: show onboarding */ }
  }, []);
  const query = prefsQuery({ lang }, tester ? { t: "1" } : {});
  return <main className="landing" lang={lang} data-testid="screen-landing">
    <img className="landing-hero" src="/kl-ipoh-drive-preview.webp" alt="" />
    <header className="landing-top">
      <p className="landing-brand">{t(lang, "appName")}</p>
      <button type="button" className="btn language-button" data-testid="landing-lang" aria-label={t(lang, "langToggle")}
        onClick={() => setLang(lang === "en" ? "bm" : "en")}>{lang === "en" ? "BM" : "EN"}</button>
    </header>
    <section className="landing-sheet">
      {tester && <p className="landing-tester" role="note">{t(lang, "testerStrip")}</p>}
      <h1>{t(lang, "landingTitle")}</h1>
      <p className="landing-sub">{t(lang, "landingSub")}</p>
      <dl className="trip-metrics">
        <div><dt>{t(lang, "distance")}</dt><dd>{Math.round(km)} km</dd></div>
        <div><dt>{t(lang, "estimatedDrive")}</dt><dd>{fmtDur(driveMinutes)}</dd></div>
        <div><dt>{t(lang, "classOneToll")}</dt><dd>{tollRm === null ? "—" : "RM " + tollRm.toFixed(2)}</dd></div>
      </dl>
      <ol className="landing-steps">
        {steps.map(([name, hint], index) => <li key={name}>
          <span className="landing-step-n" aria-hidden="true">{index + 1}</span>
          <span><strong>{t(lang, name)}</strong> · {t(lang, hint)}</span>
        </li>)}
      </ol>
      <a className="btn landing-cta" data-variant="primary" data-testid="landing-start"
        href={(returning ? "/plan" : "/onboarding") + query}>{t(lang, "planMyDrive")} <span aria-hidden="true">→</span></a>
      <p className="landing-friends">{t(lang, "meetingFriends")} <a href={"/group-arrival" + (lang === "bm" ? "?lang=bm" : "")}>{groupCopy(lang, "title")}</a></p>
    </section>
  </main>;
}
