import type { ReactNode } from "react";

export function Card({ title, source, state = "default", id, children }: {
  title: string; source?: ReactNode; state?: "default" | "loading" | "empty" | "error" | "offline" | "stale" | "unverified";
  id: string; children: ReactNode;
}) {
  return <section className="card stack" data-testid={id} data-state={state}>
    <header className="card-head"><h3>{title}</h3>{source}</header>
    {children}
  </section>;
}
