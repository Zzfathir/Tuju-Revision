"use client";

import { useEffect, useState } from "react";
import { t } from "@/lib/i18n";
import { groupCopy } from "@/lib/group-copy";
import { prefsQuery, type Prefs } from "@/lib/onboarding";

export function Landing({ initial, tester, home }: { initial: Prefs; tester: boolean; home: boolean }) {
  const [lang, setLang] = useState(initial.lang);
  const [returning, setReturning] = useState(false);
  useEffect(() => {
    try { setReturning(localStorage.getItem("jalan-pulang-onboarded") === "1"); }
    catch { /* storage may be blocked: show onboarding */ }
  }, []);
  const extra: Record<string, string> = tester ? { t: "1" } : {};
  const prefs = { ...initial, lang };
  const query = prefsQuery(prefs, extra);
  const showHome = home || returning;

  return <main className="landing" data-view={showHome ? "home" : "welcome"} lang={lang}
    data-testid={showHome ? "screen-home" : "screen-landing"}>
    <header className="landing-top">
      <p className="landing-brand">
        <svg aria-hidden="true" width="32" height="32" viewBox="0 0 56 56" fill="none">
          <path d="M10 42C19 42 22 38 22 31V20C22 14 26 10 32 10h8m-7-6 8 6-8 7"
            stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="10" cy="42" r="5" fill="currentColor" />
          <path d="M31 45c9 0 14-5 14-14" stroke="currentColor" strokeOpacity=".55" strokeWidth="5" strokeLinecap="round" />
        </svg>
        {t(lang, "appName")}
      </p>
      <button type="button" className="btn language-button" data-testid="landing-lang" aria-label={t(lang, "langToggle")}
        onClick={() => setLang(lang === "en" ? "bm" : "en")}>{lang === "en" ? "BM" : "EN"}</button>
    </header>
    {showHome ? <section className="landing-home">
      {tester && <p className="landing-tester" role="note">{t(lang, "testerStrip")}</p>}
      <h1>{t(lang, "homeTitle")}</h1>
      <p>{t(lang, "homeSub")}</p>
      <img className="home-map" src="/kl-ipoh-drive-preview.webp" alt="" />
      <a className="btn landing-cta" data-variant="primary" data-testid="home-plan"
        href={(returning ? "/plan" : "/onboarding") + query}>{t(lang, "planMyDrive")}</a>
      <nav className="landing-links" aria-label={t(lang, "homeMore")}>
        <a href={"/group-arrival" + prefsQuery({ lang })}>{groupCopy(lang, "title")}</a>
        <a href={"/about" + prefsQuery({ lang })}>{t(lang, "dataPrivacy")}</a>
      </nav>
    </section> : <section className="landing-welcome">
      <div className="welcome-art" aria-hidden="true" />
      <div className="welcome-content">
        <h1>{t(lang, "landingTitle")}</h1>
        <p>{t(lang, "landingSub")}</p>
        <a className="btn landing-cta welcome-cta" data-testid="landing-start"
          href={"/" + prefsQuery(prefs, { ...extra, home: "1" })}>{t(lang, "getStarted")}</a>
      </div>
    </section>}
  </main>;
}
