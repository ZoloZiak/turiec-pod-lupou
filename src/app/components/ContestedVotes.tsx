"use client";

import { useState } from "react";
import { ExternalLink, TrendingUp, ChevronDown } from "lucide-react";

export type Contested = {
  d: string;
  u: string | null;
  t: string;
  za: number;
  proti: number;
  zdrzal: number;
  s: string;
  tags: string[];
  margin: number;
};

const TAG_STYLE: Record<string, string> = {
  "tesný rozdiel": "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300",
  "VZN pri kvóre": "bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300",
  "silná opozícia": "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
};

function Bar({ za, proti, zdrzal }: { za: number; proti: number; zdrzal: number }) {
  const total = Math.max(za + proti + zdrzal, 1);
  return (
    <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-elevated">
      <div className="bg-emerald-500" style={{ width: `${(za / total) * 100}%` }} title={`ZA ${za}`} />
      <div className="bg-red-500" style={{ width: `${(proti / total) * 100}%` }} title={`PROTI ${proti}`} />
      <div className="bg-amber-400" style={{ width: `${(zdrzal / total) * 100}%` }} title={`ZDRŽAL SA ${zdrzal}`} />
    </div>
  );
}

export default function ContestedVotes({ items }: { items: Contested[] }) {
  const [open, setOpen] = useState(false);
  const shown = open ? items : items.slice(0, 6);

  return (
    <section className="bg-card rounded-2xl shadow-sm border border-line p-6">
      <div className="flex items-center gap-3 mb-2">
        <TrendingUp className="w-6 h-6 text-purple-400" aria-hidden="true" />
        <h2 className="text-2xl font-bold text-body">Najnapínavejšie hlasovania obdobia</h2>
      </div>
      <p className="text-sm text-muted mb-5 max-w-3xl">
        Hlasovania, kde bolo zastupiteľstvo výrazne rozdelené — tesný rozdiel, silná opozícia, alebo VZN tesne pri
        trojpätinovej hranici. Je to <strong>ukazovateľ, kam sa pozrieť</strong>, nie dôkaz pochybenia. Kliknutím
        na zdroj uvidíte menný záznam.
      </p>

      <ul className="space-y-3">
        {shown.map((c, i) => (
          <li key={`${c.d}-${c.u ?? i}`} className="rounded-xl border border-line p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-body">{c.t}</p>
                <p className="text-xs text-muted mt-0.5">
                  {c.d}
                  {c.u && <> · Uznesenie č. {c.u}</>}
                </p>
              </div>
              <div className="flex flex-wrap justify-end gap-1 shrink-0">
                {c.tags.map((t) => (
                  <span key={t} className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${TAG_STYLE[t] ?? "bg-elevated text-muted"}`}>
                    {t}
                  </span>
                ))}
              </div>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <span className="text-xs font-bold text-emerald-600 shrink-0">ZA {c.za}</span>
              <Bar za={c.za} proti={c.proti} zdrzal={c.zdrzal} />
              <span className="text-xs font-bold text-red-600 shrink-0">
                {c.proti} PROTI{c.zdrzal > 0 ? ` · ${c.zdrzal} zdržal` : ""}
              </span>
            </div>
            <a
              href={c.s}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-purple-500 hover:text-purple-400 mt-2"
            >
              <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" /> Menný záznam na martin.sk
            </a>
          </li>
        ))}
      </ul>

      {items.length > 6 && (
        <button
          onClick={() => setOpen((v) => !v)}
          className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-purple-500 hover:text-purple-400"
        >
          <ChevronDown className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
          {open ? "Zobraziť menej" : `Zobraziť všetkých ${items.length}`}
        </button>
      )}
    </section>
  );
}
