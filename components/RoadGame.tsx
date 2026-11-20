"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { CAR_BODIES, CAR_PAINTS, gameProgress, type GarageCar, type RoadGame, type RoadQuest } from "@/lib/road-game";
import type { Stop } from "@/lib/schemas";
import type { Lang } from "@/lib/i18n";
import { Facilities } from "./RoadCards";

export type GameScreen = "quests" | "quest" | "quest-place" | "place" | "garage";

export function RoadIcon({ name }: { name: string }) {
  return <img className="road-icon" src={`/road-ui/${name}.svg`} alt="" aria-hidden="true" />;
}

export function XpBadge({ game, onClick }: { game: RoadGame; onClick?: () => void }) {
  const progress = gameProgress(game);
  const label = `Level ${progress.level}, ${progress.rank}, ${progress.xp} XP`;
  const contents = <><b>{progress.level}</b><span>{progress.rank}<progress value={progress.progress} max={progress.goal} aria-label="XP to next level" /></span></>;
  return onClick ? <button type="button" className="road-xp" aria-label={`${label}. Open side quests`} onClick={onClick}>{contents}</button>
    : <div className="road-xp" aria-label={label}>{contents}</div>;
}

export function QuestDriveStatus({ quest, reward, km }: { quest?: RoadQuest; reward?: RoadQuest; km: number | null }) {
  if (reward) return <aside className="road-reward" role="status" data-testid="quest-reward"><RoadIcon name="star" /><span><small>Quest complete</small><strong>+{reward.xp} XP</strong></span></aside>;
  if (!quest) return null;
  const distance = km !== null ? `${Math.max(0, Math.ceil(quest.km - km))} km` : "";
  return <aside className="road-tracker" data-testid="quest-tracker"><small>Side quest</small><strong>{quest.title}</strong><span>{distance ? `Reach the stop · ${distance} ahead` : "Reach the stop to earn XP"}</span></aside>;
}

function QuestFacts({ quest }: { quest: RoadQuest }) {
  return <dl className="road-facts"><div><dt>Detour</dt><dd>0 km</dd></div><div><dt>Suggested stop</dt><dd>{quest.minutes} min</dd></div><div><dt>XP reward</dt><dd>+{quest.xp} XP</dd></div></dl>;
}

function Garage({ game, onApply }: { game: RoadGame; onApply: (car: GarageCar) => void }) {
  const [car, setCar] = useState(game.car);
  const [angle, setAngle] = useState(0);
  const drag = useRef<{ x: number; start: number } | null>(null);
  return <>
    <div className="road-garage-preview" data-car-paint={car.paint} data-car-body={car.body}>
      <span className="road-preview-label">Car preview</span>
      <button type="button" className="road-turntable" aria-label="Rotate car preview" style={{ "--angle": `${angle}deg` } as CSSProperties}
        onPointerDown={(event) => { drag.current = { x: event.clientX, start: angle }; event.currentTarget.setPointerCapture(event.pointerId); }}
        onPointerMove={(event) => { if (drag.current) setAngle(drag.current.start + (event.clientX - drag.current.x) * 2); }}
        onLostPointerCapture={() => { drag.current = null; }}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); setAngle((value) => value + (event.key === "ArrowRight" ? 30 : -30)); }
        }} onClick={(event) => { if (event.detail === 0) setAngle((value) => value + 30); }}>
        <RoadIcon name="turntable" /><RoadIcon name="garage-car" />
      </button>
      <span className="road-turn-hint"><RoadIcon name="rotate" />Drag to rotate 360°</span>
    </div>
    <div className="road-filters" role="group" aria-label="Car body">
      {CAR_BODIES.map((body) => <button type="button" key={body} aria-pressed={body === car.body} onClick={() => setCar({ ...car, body })}>{body === car.body && "✓ "}{body === "suv" ? "SUV" : body[0].toUpperCase() + body.slice(1)}</button>)}
    </div>
    <h3>Paint</h3>
    <div className="road-swatches" role="group" aria-label="Car paint">
      {CAR_PAINTS.map((paint) => <button type="button" key={paint} data-car-paint={paint} aria-label={`${paint} paint`} aria-pressed={paint === car.paint} onClick={() => setCar({ ...car, paint })} />)}
    </div>
    <details className="road-garage-extra"><summary className="road-extra"><span><strong>Number plate</strong><small>{car.plate || "JLN 2026"}</small></span><RoadIcon name="chevron" /></summary>
      <label className="road-plate-field">Plate text<input className="input" value={car.plate ?? ""} maxLength={10} placeholder="JLN 2026" autoComplete="off"
        onChange={(event) => setCar({ ...car, plate: event.target.value.toUpperCase().replace(/[^A-Z0-9 ]/g, "") })} /></label></details>
    <label className="road-extra"><span><strong>Map glow</strong><small>Add a soft glow under your car</small></span>
      <input type="checkbox" checked={car.trail} onChange={(event) => setCar({ ...car, trail: event.target.checked })} /></label>
    <footer className="road-sheet-actions"><button className="btn" type="button" data-variant="primary" onClick={() => onApply(car)}>Drive with this car</button></footer>
  </>;
}

type GameSheetProps = {
  screen: GameScreen; game: RoadGame; quests: RoadQuest[]; quest?: RoadQuest; stop: Stop | null; lang: Lang;
  onClose: () => void; onBack: () => void; onQuest: (quest: RoadQuest) => void; onQuestPlace: () => void;
  onStart: (quest: RoadQuest) => void; onApplyCar: (car: GarageCar) => void;
  onSave: (stop: Stop) => void; onRoutes: (stop: Stop) => void;
};

export function GameSheet({ screen, game, quests, quest, stop, lang, onClose, onBack, onQuest, onQuestPlace, onStart, onApplyCar, onSave, onRoutes }: GameSheetProps) {
  const [filter, setFilter] = useState<"route" | "nearby" | "done">("route");
  const title = useRef<HTMLHeadingElement>(null);
  const sheet = useRef<HTMLElement>(null);
  const progress = gameProgress(game);
  const place = screen === "place" || screen === "quest-place";
  const saved = stop ? game.saved.includes(stop.id) : false;
  useEffect(() => { sheet.current?.scrollTo({ top: 0 }); title.current?.focus({ preventScroll: true }); }, [screen]);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [onClose]);

  let content: ReactNode;
  if (screen === "quests") {
    const filtered = quests.filter((item) => filter === "done" ? game.done.includes(item.id) : !game.done.includes(item.id) && (filter !== "nearby" || item.km <= 50));
    content = <>
      <header className="road-sheet-head"><div><small>Level {progress.level} · {progress.next} XP to level {progress.level + 1}</small><h2 ref={title} tabIndex={-1} id="road-sheet-title">Side quests</h2></div>
        <button type="button" className="road-close" aria-label="Close side quests" onClick={onClose}>×</button></header>
      <div className="road-filters" role="group" aria-label="Filter side quests">
        {([["route", "On my route"], ["nearby", "Nearby"], ["done", "Done"]] as const).map(([value, label]) => <button type="button" key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{filter === value && "✓ "}{label}</button>)}
      </div>
      <ul className="road-quest-list">{filtered.map((item) => <li key={item.id}>
        <button type="button" className="road-quest-row" onClick={() => onQuest(item)}>
          <span className="road-quest-glyph"><RoadIcon name={game.done.includes(item.id) ? "check" : "quest-marker"} /></span>
          <span><strong>{item.title}</strong><span className="road-quest-meta">On your route · {item.minutes} min stop</span><span className="road-quest-tags"><b>+{item.xp} XP</b><small>{game.active === item.id ? "Active" : item.category}</small></span></span><RoadIcon name="chevron" />
        </button></li>)}</ul>
      {!filtered.length && <p className="muted" role="status">{filter === "done" ? "Your completed quests will appear here." : "No side quests in this area."}</p>}
      <footer className="road-sheet-actions"><button type="button" className="btn" onClick={onClose}>Later</button></footer>
    </>;
  } else if (screen === "garage") {
    content = <><header className="road-garage-top"><button type="button" className="road-back" onClick={onClose}><RoadIcon name="back" /> Back</button><XpBadge game={game} /></header>
      <h2 ref={title} tabIndex={-1} id="road-sheet-title">Garage</h2><p className="muted road-garage-caption">Pick the car you see on the map.</p><Garage game={game} onApply={onApplyCar} /></>;
  } else {
    const visited = quest ? game.done.includes(quest.id) : false;
    const active = quest ? game.active === quest.id : false;
    content = <>
      {place && stop && <div className="road-place-actions"><span className="road-place-category"><RoadIcon name={quest ? "quest-marker" : "place-category"} /></span>
        <button type="button" className="btn" aria-pressed={saved} onClick={() => onSave(stop)}>{saved ? "★ Saved" : "☆ Save place"}</button></div>}
      {quest && <small className="road-quest-overline">Side quest · {quest.category}</small>}
      <h2 ref={title} tabIndex={-1} id="road-sheet-title">{place ? stop?.name : quest?.title}</h2>
      {stop && <p className="road-quest-meta">{Math.round(stop.distanceAlongRoute_km)} km from trip start{quest && ` · ${quest.minutes} min suggested stop`}</p>}
      {quest ? <>
        {place && <h3>Quest rewards</h3>}
        <QuestFacts quest={quest} />
        <h3>Objectives</h3>
        <ul className="road-objectives"><li><span data-done={active || visited}>{active || visited ? "✓" : ""}</span>Start the side quest</li><li><span data-done={visited}>{visited ? "✓" : ""}</span>Reach the stop on your drive</li></ul>
        {!place && stop && <button type="button" className="road-text-action" onClick={onQuestPlace}>View stop details <RoadIcon name="chevron" /></button>}
      </> : stop && <><h3>Onsite services</h3><Facilities stop={stop} lang={lang} />
        <h3>Opening hours</h3><p className="road-quest-meta">Hours are unverified.</p></>}
      <footer className="road-sheet-actions"><button type="button" className="btn" onClick={onClose}>{quest ? "Later" : "Go later"}</button>
        {quest ? <button type="button" className="btn" data-variant="primary" disabled={visited} onClick={() => onStart(quest)}>{visited ? "Completed" : active ? "Continue quest" : "Start side quest"}</button>
          : <button type="button" className="btn" data-variant="primary" onClick={() => stop && onRoutes(stop)}>View routes</button>}</footer>
    </>;
  }

  return <>
    {screen !== "quests" && screen !== "garage" && <div className="road-sheet-map-nav"><button type="button" className="road-close" aria-label="Back" onClick={onBack}>‹</button><button type="button" className="road-close" aria-label="Close details" onClick={onClose}>×</button></div>}
    <section ref={sheet} className="road-sheet" data-screen={screen} aria-labelledby="road-sheet-title">
      {screen !== "garage" && <div className="road-sheet-grabber" aria-hidden="true" />}
      {content}
    </section>
  </>;
}
