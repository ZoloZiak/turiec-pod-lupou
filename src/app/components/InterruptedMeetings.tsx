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

type QuorumFailure = {
  date: string;
  label: string;
  outcome: string;
  quote: string;
};

type InterruptedData = {
  interruptedMeetings: number;
  continuationDays: number;
  scheduledMeetings: number;
  chains: Chain[];
  quorumNote?: string;
  quorumSrc?: string;
  quorumFailures?: QuorumFailure[];
};

function fmt(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${parseInt(d, 10)}.${parseInt(m, 10)}.${y}`;
}

const OUTCOME_STYLE: Record<string, { label: string; cls: string }> = {
  "prerušené": {
    label: "prerušené",
    cls: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
  },
  "ukončené": {
    label: "ukončené",
    cls: "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300",
  },
  "nezačalo": {
    label: "nezačalo",
    cls: "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300",
  },
};

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

      {data.quorumFailures && data.quorumFailures.length > 0 && (
        <div className="mt-8 border-t border-line pt-6">
          <h3 className="text-lg font-bold text-body mb-1">
            Prečo sa nedokončili: {data.quorumFailures.length}× padlo kvórum priamo v sále
          </h3>
          <p className="text-sm text-muted mb-1 max-w-3xl">
            Zastupiteľstvo môže hlasovať, len kým je uznášaniaschopné — teda kým je v sále dosť
            poslancov. Keď časť odíde, kvórum padne a o zvyšných bodoch sa už nehlasuje. V týchto
            prípadoch to zápisnica zachytáva doslovne: rokovanie sa muselo prerušiť, ukončiť, alebo
            sa vôbec nezačalo.
          </p>
          <p className="text-xs text-muted mb-4 max-w-3xl">
            Toto je ten druhý spôsob, ako sa návrh dá „zabiť“ bez toho, aby sa o ňom hlasovalo —
            jednoducho sa k nemu zbor nedostane. V menovitých hlasovaniach preto nie je vidno.
          </p>
          <ul className="space-y-2.5">
            {data.quorumFailures.map((q) => {
              const st = OUTCOME_STYLE[q.outcome] ?? OUTCOME_STYLE["ukončené"];
              return (
                <li key={q.date} className="rounded-xl border border-line p-4">
                  <div className="flex items-start justify-between gap-4 mb-1.5">
                    <p className="text-sm font-semibold text-body">{q.label}</p>
                    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${st.cls}`}>
                      {st.label}
                    </span>
                  </div>
                  <p className="text-xs text-muted">{q.quote}</p>
                </li>
              );
            })}
          </ul>
          {data.quorumSrc && (
            <a
              href={data.quorumSrc}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-purple-500 hover:text-purple-400 mt-3"
            >
              Zápisnice z rokovaní na martin.sk
            </a>
          )}
        </div>
      )}
    </section>
  );
}
