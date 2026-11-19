"use client";

import { useEffect, useState, type FormEvent } from "react";
import { sendEvent } from "@/lib/events";
import { t, type Lang } from "@/lib/i18n";
import { Card } from "./ui/Card";

const tasks = [1, 2, 3] as const;

export function TesterTasks({ lang }: { lang: Lang }) {
  const [done, setDone] = useState<number[]>([]);
  const [pending, setPending] = useState<number[]>([]);
  const [failed, setFailed] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    try {
      const saved: unknown = JSON.parse(sessionStorage.getItem("jalan-pulang-tasks") ?? "[]");
      if (Array.isArray(saved)) setDone(tasks.filter((n) => saved.includes(n)));
      setSent(sessionStorage.getItem("jalan-pulang-feedback") === "sent");
    } catch { /* session storage may be unavailable */ }
  }, []);

  const complete = async (task: typeof tasks[number]) => {
    setFailed(false);
    setPending((old) => [...old, task]);
    if (await sendEvent("task_done:" + task as `task_done:${typeof task}`)) {
      setDone((old) => [...old, task]);
      try {
        const saved = JSON.parse(sessionStorage.getItem("jalan-pulang-tasks") ?? "[]");
        sessionStorage.setItem("jalan-pulang-tasks", JSON.stringify([...new Set([...saved, task])]));
      } catch { /* session storage may be unavailable */ }
    } else setFailed(true);
    setPending((old) => old.filter((n) => n !== task));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSending(true);
    setFailed(false);
    const result = await fetch("/api/event", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ feedback: feedback.trim() }),
    }).catch(() => null);
    if (result?.ok) {
      setSent(true);
      try { sessionStorage.setItem("jalan-pulang-feedback", "sent"); } catch { /* optional storage */ }
    } else setFailed(true);
    setSending(false);
  };

  return <Card id="tester-tasks" title={t(lang, "testerTitle")}>
    <ol className="task-list">
      {tasks.map((task) => <li key={task}>
        {t(lang, `task${task}`)}{" "}
        <button type="button" className="btn" disabled={done.includes(task) || pending.includes(task)}
          data-testid={`tester-task-${task}`} onClick={() => void complete(task)}>
          {t(lang, done.includes(task) ? "completed" : "taskDone")}
        </button>
      </li>)}
    </ol>
    {done.includes(3) && (sent ? <p role="status">{t(lang, "thanks")}</p> : <form className="stack" onSubmit={submit}>
      <label className="field">{t(lang, "feedbackQ")}
        <textarea className="input" maxLength={500} value={feedback} onChange={(event) => setFeedback(event.target.value)} />
      </label>
      <button type="submit" className="btn" disabled={!feedback.trim() || sending}>{t(lang, "send")}</button>
    </form>)}
    {failed && <p role="alert">{t(lang, "eventFailed")}</p>}
  </Card>;
}
