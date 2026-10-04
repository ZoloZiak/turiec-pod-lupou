"use client";

import { useState } from "react";
import { ExternalLink, TrendingUp, ChevronDown, Check, X } from "lucide-react";

export type Contested = {
  d: string;
  u: string | null;
  t: string;
  full?: string;
  desc?: string;
  za: number;
  proti: number;
  zdrzal: number;
  s: string;
  tags: string[];
  margin: number;
  // prahove polia (z council-votes.json) pre prahovu os
  pr?: number; // pocet pritomnych poslancov
  nd?: number; // potrebna hranica (kvorum pre dany typ bodu)
  passed?: boolean; // preslo / neprešlo
  rl?: string; // typ pravidla: "nadpolovicna" | "vzn_3_5"
  nehl?: number; // zaprezentoval sa, ale nehlasoval
};

const TAG_STYLE: Record<string, string> = {
  "tesný rozdiel": "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300",
  "VZN pri kvóre": "bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300",
  "silná opozícia": "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
};

const RULE_LABEL: Record<string, string> = {
  nadpolovicna: "bežná väčšina prítomných",
  vzn_3_5: "VZN — potrebné 3/5 prítomných",
};

function hlasSuffix(n: number): string {
  const a = Math.abs(n);
  if (a === 1) return "hlas";
  if (a >= 2 && a <= 4) return "hlasy";
  return "hlasov";
}

/**
 * Prahova os: horizontalna skala 0..pr (pocet pritomnych). Vyplnena cast = kolko
 * poslancov hlasovalo ZA. Zlta zvisla ciara = kolko hlasov bolo TREBA (hranica nd).
 * Farba vyplne = ci ZA dosiahlo hranicu (preslo = emerald, padlo = red).
 */
function ThresholdAxis({
  za,
  pr,
  nd,
  passed,
}: {
  za: number;
  pr: number;
  nd: number;
  passed: boolean;
}) {
  const total = Math.max(pr, 1);
  const zaPct = Math.min((za / total) * 100, 100);
  const ndPct = Math.min((nd / total) * 100, 100);
  const fill = passed ? "bg-emerald-500" : "bg-red-500";

  return (
    <div className="relative h-5" aria-hidden="true">
      {/* dráha */}
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-3 rounded-full bg-elevated" />
      {/* výplň ZA */}
      <div
        className={`absolute left-0 top-1/2 -translate-y-1/2 h-3 rounded-full ${fill}`}
        style={{ width: `${zaPct}%` }}
      />
      {/* čiara hranice */}
      <div
        className="absolute top-0 bottom-0 w-0.5 bg-amber-400"
        style={{ left: `calc(${ndPct}% - 1px)` }}
      />
    </div>
  );
}

function VoteCard({ c }: { c: Contested }) {
  const hasThreshold =
    typeof c.pr === "number" && typeof c.nd === "number" && typeof c.passed === "boolean";
  const za = c.za;
  const nd = c.nd ?? 0;
  const passed = c.passed ?? false;
  const diff = za - nd; // + prebytok, - koľko chýbalo

  return (
    <li className="rounded-xl border border-line p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-body">{c.full ?? c.t}</p>
          {c.desc && <p className="text-xs text-muted mt-1 leading-relaxed">{c.desc}</p>}
          <p className="text-xs text-muted mt-0.5">
            {c.d}
            {c.u && <> · Uznesenie č. {c.u}</>}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          {hasThreshold &&
            (passed ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                <Check className="w-3 h-3" aria-hidden="true" /> PREŠLO
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-[11px] font-bold text-red-700 dark:bg-red-950/50 dark:text-red-300">
                <X className="w-3 h-3" aria-hidden="true" /> NEPREŠLO
              </span>
            ))}
          <div className="flex flex-wrap justify-end gap-1">
            {c.tags.map((t) => (
              <span
                key={t}
                className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${TAG_STYLE[t] ?? "bg-elevated text-muted"}`}
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>

      {hasThreshold ? (
        <div className="mt-3">
          <ThresholdAxis za={za} pr={c.pr as number} nd={nd} passed={passed} />
          <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted">
            <span>
              <strong className="text-body">{za}</strong> hlasov za
              <span className="text-muted"> z {c.pr} prítomných</span>
            </span>
            <span className="text-amber-600 dark:text-amber-400 font-semibold">▲ treba {nd}</span>
          </div>
          <p
            className={`mt-1 text-[12px] font-semibold ${
              passed ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
            }`}
          >
            {passed
              ? diff === 0
                ? "Prešlo presne na hranici."
                : `Prešlo o ${diff} ${hlasSuffix(diff)} nad hranicu.`
              : `Chýbal${-diff === 1 ? "" : "o"} ${-diff} ${hlasSuffix(-diff)} za hranicu.`}
            <span className="font-normal text-muted"> · {RULE_LABEL[c.rl ?? ""] ?? "hlasovanie"}</span>
          </p>
        </div>
      ) : (
        // zaloha ak chyba prahove pole (nemalo by nastat) — jednoducha ZA/PROTI veta
        <p className="mt-3 text-xs text-muted">
          <strong className="text-emerald-600">{za} za</strong> · {c.proti} proti
          {c.zdrzal > 0 ? ` · ${c.zdrzal} zdržal` : ""}
        </p>
      )}

      <a
        href={c.s}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-xs text-purple-500 hover:text-purple-400 mt-2"
      >
        <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" /> Menný záznam na martin.sk
      </a>
    </li>
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
      <p className="text-sm text-muted mb-4 max-w-3xl">
        Hlasovania, kde bolo zastupiteľstvo výrazne rozdelené — tesný rozdiel, silná opozícia, alebo VZN tesne pri
        trojpätinovej hranici. Je to <strong>ukazovateľ, kam sa pozrieť</strong>, nie dôkaz pochybenia. Kliknutím
        na zdroj uvidíte menný záznam.
      </p>

      {/* legenda prahovej osi */}
      <div className="mb-5 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[11px] text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-5 rounded-full bg-emerald-500" /> hlasov za (prešlo)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-5 rounded-full bg-red-500" /> hlasov za (padlo)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3.5 w-0.5 bg-amber-400" /> koľko hlasov bolo treba
        </span>
      </div>

      <ul className="space-y-3">
        {shown.map((c, i) => (
          <VoteCard key={`${c.d}-${c.u ?? "x"}-${i}`} c={c} />
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
