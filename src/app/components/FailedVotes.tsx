"use client";

import { ExternalLink, XCircle } from "lucide-react";
import type { FailedVote } from "../../lib/councilVotes";

// Vizuálny pomer ZA / proti / zdržal s vyznačenou hranicou kvóra.
function ResultBar({ v }: { v: FailedVote }) {
  const total = Math.max(v.present, 1);
  const zaPct = (v.za / total) * 100;
  const protiPct = (v.proti / total) * 100;
  const zdrzalPct = (v.zdrzal / total) * 100;
  const needPct = (v.needed / total) * 100;
  return (
    <div className="relative h-5 w-full overflow-hidden rounded-full bg-elevated">
      <div className="absolute inset-y-0 left-0 bg-emerald-500" style={{ width: `${zaPct}%` }} title={`ZA ${v.za}`} />
      <div className="absolute inset-y-0 bg-red-500" style={{ left: `${zaPct}%`, width: `${protiPct}%` }} title={`PROTI ${v.proti}`} />
      <div className="absolute inset-y-0 bg-amber-400" style={{ left: `${zaPct + protiPct}%`, width: `${zdrzalPct}%` }} title={`zdržal ${v.zdrzal}`} />
      {/* hranica potrebného kvóra */}
      <div
        className="absolute inset-y-0 w-0.5 bg-body/80"
        style={{ left: `calc(${needPct}% - 1px)` }}
        title={`potrebných ${v.needed} hlasov ZA`}
      />
    </div>
  );
}

function ruleLabel(rule: FailedVote["rule"]): string {
  if (rule === "vzn_3_5") return "VZN · 3/5 prítomných";
  if (rule === "nadpolovicna") return "nadpolovičná prítomných";
  return "";
}

export default function FailedVotes({ items, total, presentNotVoting }: { items: FailedVote[]; total: number; presentNotVoting: number }) {
  if (!items.length) return null;

  return (
    <section className="bg-card rounded-2xl shadow-sm border border-line p-6">
      <div className="flex items-center gap-3 mb-2">
        <XCircle className="w-6 h-6 text-red-400" aria-hidden="true" />
        <h2 className="text-2xl font-bold text-body">Čo neprešlo</h2>
      </div>
      <p className="text-sm text-muted mb-5 max-w-3xl">
        Pri menovitom hlasovaní padlo na kvóre <strong className="text-body">{items.length}</strong>{" "}
        {items.length === 1 ? "návrh" : items.length < 5 ? "návrhy" : "návrhov"} z {total}, pri ktorých
        sa hlasovalo menovite. VZN a dodatky potrebujú trojpätinovú väčšinu{" "}
        <strong>prítomných</strong>, bežné uznesenie nadpolovičnú — kvórum sa počíta z tých, čo sedia v sále.
        Zvislá čiara v pruhu je hranica, ktorú bolo treba prekročiť. Kto bol proti, vidíte menovite;
        je to verejný záznam, nie obvinenie.
      </p>
      <p className="text-xs text-muted/80 mb-5 max-w-3xl border-l-2 border-amber-400/60 pl-3">
        <strong className="text-muted">Toto číslo nie je mierou zhody.</strong> Je to najužšia možná
        kategória — návrh, ktorý sa dostal až k menovitému hlasovaniu a tam nezískal dosť hlasov.
        Reálne sa v zastupiteľstve brzdí aj inak, a tieto cesty sem nespadajú: body stiahnuté z programu
        pred hlasovaním, pozmeňujúce a protinávrhy, ktoré neprešli, aj hlasovania, kde sa časť poslancov
        zaprezentovala, ale nehlasovala (to sa stalo v {presentNotVoting} hlasovaniach). Samostatná vec sú
        body odložené po predčasnom konci zasadnutia — <a href="#nedokoncene" className="text-purple-500 hover:text-purple-400 underline">tie sme vyčíslili nižšie</a>.
        Kde sa zastupiteľstvo reálne delí, ukazuje prehľad <a href="/dramy" className="text-purple-500 hover:text-purple-400 underline">sporných hlasovaní</a>.
      </p>

      <ul className="space-y-4">
        {items.map((v, i) => (
          <li key={`${v.date}-${v.resolution ?? i}`} className="rounded-xl border border-line p-4">
            <div className="flex items-start justify-between gap-4 mb-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-body">{v.title}</p>
                <p className="text-xs text-muted mt-0.5">
                  {v.date}
                  {v.resolution && <> · Uznesenie č. {v.resolution}</>}
                  {v.rule && <> · {ruleLabel(v.rule)}</>}
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300 px-2.5 py-0.5 text-[11px] font-bold">
                neprešlo
              </span>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-emerald-600 shrink-0 w-12 text-right">ZA {v.za}</span>
              <ResultBar v={v} />
              <span className="text-xs font-bold text-red-600 shrink-0 w-24">
                {v.proti} proti{v.zdrzal > 0 ? ` · ${v.zdrzal} zdrž.` : ""}
              </span>
            </div>

            <p className="text-xs text-muted mt-2">
              {v.missing > 0 ? (
                <>Chýbal{v.missing === 1 ? " jediný hlas" : `i ${v.missing} hlasy`} do schválenia
                  {" "}(treba {v.needed} z {v.present} prítomných).</>
              ) : (
                <>Nedosiahlo potrebných {v.needed} hlasov z {v.present} prítomných.</>
              )}
            </p>

            {v.againstNames.length > 0 && (
              <div className="mt-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted mb-1">
                  Proti ({v.againstNames.length})
                </p>
                <div className="flex flex-wrap gap-1">
                  {v.againstNames.map((n) => (
                    <span key={n} className="rounded-md bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 px-2 py-0.5 text-[11px]">
                      {n}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {v.abstainNames.length > 0 && (
              <div className="mt-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted mb-1">
                  Zdržali sa ({v.abstainNames.length})
                </p>
                <div className="flex flex-wrap gap-1">
                  {v.abstainNames.map((n) => (
                    <span key={n} className="rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 px-2 py-0.5 text-[11px]">
                      {n}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <a
              href={v.source}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-purple-500 hover:text-purple-400 mt-3"
            >
              <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" /> Menný záznam na martin.sk
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
