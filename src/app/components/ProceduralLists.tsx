"use client";

import { useState, useEffect } from "react";

export type Chain = {
  root: string;
  label: string;
  continuations: string[];
  src: string;
  note: string;
};
export type QuorumFailure = { date: string; label: string; outcome: string; quote: string };
export type Withdrawal = { date: string; who: string; what: string; outcome: string; quote: string };

export type InterruptedData = {
  interruptedMeetings: number;
  continuationDays: number;
  scheduledMeetings: number;
  chains: Chain[];
  quorumNote?: string;
  quorumSrc?: string;
  quorumFailures?: QuorumFailure[];
  withdrawals?: Withdrawal[];
  amendmentsTotal?: number;
  amendmentsMeetings?: number;
};

export function useInterrupted(): InterruptedData | null {
  const [data, setData] = useState<InterruptedData | null>(null);
  useEffect(() => {
    fetch("/data/council-interrupted.json")
      .then((r) => r.json())
      .then((d: InterruptedData) => setData(d))
      .catch(() => {});
  }, []);
  return data;
}

export function fmt(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${parseInt(d, 10)}.${parseInt(m, 10)}.${y}`;
}

const OUTCOME_STYLE: Record<string, { label: string; cls: string }> = {
  "prerušené": { label: "prerušené", cls: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300" },
  "ukončené": { label: "ukončené", cls: "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300" },
  "nezačalo": { label: "nezačalo", cls: "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300" },
};

function SourceLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-xs text-purple-500 hover:text-purple-400 mt-3"
    >
      {children}
    </a>
  );
}

/** Holý zoznam prerušených zasadnutí (bez nadpisu/sekcie) — do dropdownu. */
export function ChainsList({ chains }: { chains: Chain[] }) {
  return (
    <ul className="space-y-3">
      {chains.map((c) => (
        <li key={c.root} className="rounded-xl border border-line p-4">
          <div className="flex items-start justify-between gap-4 mb-1.5">
            <p className="text-sm font-semibold text-body">Zasadnutie {c.label}</p>
            <span className="shrink-0 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 px-2.5 py-0.5 text-[11px] font-bold">
              {c.continuations.length}× pokračovanie
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-xs mb-2">
            <span className="rounded-md bg-elevated px-2 py-0.5 font-medium text-body">{fmt(c.root)}</span>
            {c.continuations.map((d) => (
              <span key={d} className="flex items-center gap-1.5">
                <span className="text-muted">→</span>
                <span className="rounded-md bg-elevated px-2 py-0.5 text-muted">{fmt(d)}</span>
              </span>
            ))}
          </div>
          <p className="text-xs text-muted">{c.note}</p>
          <SourceLink href={c.src}>Uznesenia na martin.sk</SourceLink>
        </li>
      ))}
    </ul>
  );
}

/** Holý zoznam padnutých kvór. */
export function QuorumList({ items, src }: { items: QuorumFailure[]; src?: string }) {
  return (
    <>
      <ul className="space-y-2.5">
        {items.map((q) => {
          const st = OUTCOME_STYLE[q.outcome] ?? OUTCOME_STYLE["ukončené"];
          return (
            <li key={q.date} className="rounded-xl border border-line p-4">
              <div className="flex items-start justify-between gap-4 mb-1.5">
                <p className="text-sm font-semibold text-body">{q.label}</p>
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${st.cls}`}>{st.label}</span>
              </div>
              <p className="text-xs text-muted">{q.quote}</p>
            </li>
          );
        })}
      </ul>
      {src && <SourceLink href={src}>Zápisnice z rokovaní na martin.sk</SourceLink>}
    </>
  );
}

/** Holý zoznam pokusov vyhodiť bod z programu. */
export function WithdrawalsList({ items }: { items: Withdrawal[] }) {
  return (
    <ul className="space-y-2.5">
      {items.map((w, i) => (
        <li key={`${w.date}-${i}`} className="rounded-xl border border-line p-4">
          <div className="flex items-start justify-between gap-4 mb-1.5">
            <p className="text-sm font-semibold text-body">
              {fmt(w.date)} — {w.who}
            </p>
            <span
              className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                w.outcome === "prešlo"
                  ? "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300"
                  : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
              }`}
            >
              {w.outcome === "prešlo" ? "bod vyhodený" : "bod ostal"}
            </span>
          </div>
          <p className="text-xs text-muted">{w.quote}</p>
        </li>
      ))}
    </ul>
  );
}
