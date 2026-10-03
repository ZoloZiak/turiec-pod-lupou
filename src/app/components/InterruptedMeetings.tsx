"use client";

import { useState, useEffect } from "react";
import { CalendarX } from "lucide-react";

type Chain = {
  root: string;
  label: string;
  continuations: string[];
  src: string;
  note: string;
};

type InterruptedData = {
  interruptedMeetings: number;
  continuationDays: number;
  scheduledMeetings: number;
  chains: Chain[];
};

function fmt(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${parseInt(d, 10)}.${parseInt(m, 10)}.${y}`;
}

export default function InterruptedMeetings() {
  const [data, setData] = useState<InterruptedData | null>(null);

  useEffect(() => {
    fetch("/data/council-interrupted.json")
      .then((r) => r.json())
      .then((d: InterruptedData) => setData(d))
      .catch(() => {});
  }, []);

  if (!data) return null;

  const pct = Math.round((100 * data.interruptedMeetings) / data.scheduledMeetings);

  return (
    <section id="nedokoncene" className="bg-card rounded-2xl shadow-sm border border-line p-6 scroll-mt-20">
      <div className="flex items-center gap-3 mb-2">
        <CalendarX className="w-6 h-6 text-rose-400" aria-hidden="true" />
        <h2 className="text-2xl font-bold text-body">Zasadnutia, ktoré sa nestihli dokončiť</h2>
      </div>
      <p className="text-sm text-muted mb-2 max-w-3xl">
        Nie každý bod programu sa odhlasuje. Niekedy sa zasadnutie skončí skôr — po dlhej rozprave, keď
        sa poslanci rozídu a lavica sa preriedi, zvyšok programu sa odloží na ďalší termín. Za toto
        obdobie sa <strong className="text-body">{data.interruptedMeetings}</strong> z{" "}
        <strong className="text-body">{data.scheduledMeetings}</strong> riadnych zasadnutí ({pct} %)
        nepodarilo dokončiť v jeden deň — dokopy si vyžiadali{" "}
        <strong className="text-body">{data.continuationDays}</strong> ďalších rokovacích termínov.
      </p>
      <p className="text-xs text-muted mb-5 max-w-3xl">
        Toto číslo sa nedá vyčítať z menovitých hlasovaní (tie ukazujú len body, pri ktorých sa naozaj
        hlasovalo). Vychádza z hlavičiek úradných uznesení, kde je napísané „pokračovanie MsZ z…“.
      </p>
      <ul className="space-y-3">
        {data.chains.map((c) => (
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
            <a
              href={c.src}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-purple-500 hover:text-purple-400 mt-2"
            >
              Uznesenia na martin.sk
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
