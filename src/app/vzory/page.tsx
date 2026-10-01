"use client";

import SiteNav from "../components/SiteNav";
import CouncilCircle from "../components/CouncilCircle";
import Link from "next/link";
import { useState, useEffect, useMemo } from "react";
import { Network, CalendarCheck, Shuffle, Info, Trophy } from "lucide-react";
import { CouncilData, analyze, Analysis } from "../../lib/councilVotes";

function Bar({ pct, tone }: { pct: number; tone: "red" | "emerald" | "amber" }) {
  const bg = tone === "red" ? "bg-red-500" : tone === "emerald" ? "bg-emerald-500" : "bg-amber-400";
  return (
    <div className="h-2 flex-1 rounded-full bg-elevated overflow-hidden min-w-[60px]">
      <div className={`h-full ${bg}`} style={{ width: `${Math.max(2, Math.min(100, pct))}%` }} />
    </div>
  );
}

export default function VzoryPage() {
  const [data, setData] = useState<CouncilData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/data/council-votes.json")
      .then((r) => r.json())
      .then((d: CouncilData) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const a: Analysis | null = useMemo(() => (data ? analyze(data) : null), [data]);

  const topAttend = a?.attendance[0];

  return (
    <div className="min-h-screen bg-surface text-body pb-20">
      <SiteNav />
      <header className="bg-card text-body pt-16 pb-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <Link href="/" className="text-sm font-medium text-muted hover:text-body mb-4 block">&larr; Dashboard</Link>
          <h1 className="text-4xl font-extrabold flex items-center gap-3">
            <Network className="w-10 h-10 text-purple-400" aria-hidden="true" /> Vzory v hlasovaní
          </h1>
          <p className="text-lg text-muted mt-4 max-w-3xl">
            Nie jedno hlasovanie, ale celý obraz. Z {a ? a.totalVotings.toLocaleString("sk") : "všetkých"} menovitých
            hlasovaní zastupiteľstva vidno, kto chodí, kto drží spolu a kde vedú deliace čiary. Všetko sa počíta naživo
            z dát — keď pribudne zasadnutie, obraz sa prekreslí sám.
          </p>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 -mt-12 space-y-6">
        {loading || !a ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          </div>
        ) : (
          <>
            {/* ÚČASŤ — navrchu, vypromovaná */}
            <section className="bg-card rounded-2xl shadow-sm border border-line p-6">
              <div className="flex items-center gap-3 mb-2">
                <CalendarCheck className="w-6 h-6 text-blue-400" aria-hidden="true" />
                <h2 className="text-2xl font-bold text-body">Kto chodí hlasovať</h2>
              </div>
              <p className="text-sm text-muted mb-4 max-w-3xl">
                Podiel hlasovaní, pri ktorých bol poslanec prítomný, za celý čas jeho členstva v rade. Toto nie je
                o politike — je to o tom, kto si robí mandát, za ktorý berie plat. Neúčasť môže mať legitímne dôvody,
                preto ukazujeme aj počet zasadnutí, ktoré niekto <strong>vynechal celé</strong>.
              </p>
              {topAttend && (
                <div className="mb-4 rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/40 p-4 flex items-start gap-3">
                  <Trophy className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" aria-hidden="true" />
                  <p className="text-sm text-body/90">
                    Najspoľahlivejšia dochádzka: <strong>{topAttend.name}</strong> — prítomný pri{" "}
                    <strong>{topAttend.presentPct.toFixed(1)} %</strong> z {topAttend.member} hlasovaní a{" "}
                    {topAttend.fullAbsent === 0 ? (
                      <>nevynechal <strong>ani jedno zasadnutie celé</strong> za celé volebné obdobie.</>
                    ) : (
                      <>vynechal celkom {topAttend.fullAbsent} zasadnutí.</>
                    )}
                  </p>
                </div>
              )}
              <ul className="space-y-2">
                {a.attendance.map((r) => (
                  <li key={r.name} className="flex items-center gap-3">
                    <span className="w-48 shrink-0 text-sm text-body truncate">{r.name}</span>
                    <Bar pct={r.presentPct} tone={r.presentPct >= 85 ? "emerald" : r.presentPct >= 65 ? "amber" : "red"} />
                    <span className="w-36 shrink-0 text-right text-xs text-muted">
                      {r.presentPct.toFixed(0)} %
                      {r.fullAbsent > 0 && <span className="text-red-400"> · {r.fullAbsent}× chýbal celé</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            {/* KRUH TÁBOROV */}
            <section className="bg-card rounded-2xl shadow-sm border border-line p-6">
              <div className="flex items-center gap-3 mb-2">
                <Network className="w-6 h-6 text-purple-400" aria-hidden="true" />
                <h2 className="text-2xl font-bold text-body">Dva tábory v rade</h2>
              </div>
              <p className="text-sm text-muted mb-2 max-w-3xl">
                Každá bodka je poslanec. Čiara spája dvoch, ktorí{" "}
                <strong>na sporných hlasovaniach</strong> hlasujú rovnako (aspoň v 80 % prípadov). Keď sa čiary
                zoskupia do dvoch chumáčov, rada má dva tábory — a presne to tu vidno: {a.blocSize} v jednom,{" "}
                {a.oppSize} v druhom. Nikoho sme do tábora nezaradili ručne — vypočítal to algoritmus zo zhody hlasov.
              </p>
              <p className="text-xs text-muted mb-4 max-w-3xl">
                Dôležité: berieme len {a.contestedVotings} <strong>sporných</strong> hlasovaní (kde sa rada rozdelila),
                nie rutinu, kde sú si všetci jednotní. Tam sa totiž tábory ukážu najčistejšie.
              </p>
              <CouncilCircle nodes={a.circle.nodes} edges={a.circle.edges} />
            </section>

            {/* Je rada rozdelená? */}
            <section className="bg-card rounded-2xl shadow-sm border border-line p-6">
              <h2 className="text-xl font-bold text-body mb-2">Je martinská rada rozhádaná?</h2>
              <p className="text-body/90">
                Na prvý pohľad nie — až <strong className="text-emerald-500">{a.unanimousShare.toFixed(0)} %</strong>{" "}
                hlasovaní prejde takmer jednomyseľne. Väčšina rozhodnutí je nespornou rutinou. Napätie je v tých pár
                percentách, kde ide o peniaze alebo princíp — a práve tam sa ukáže, že tábory existujú a držia spolu
                prekvapivo pevne.
              </p>
              <p className="text-body/90 mt-3">
                A deliace čiary majú reálne dôsledky. VZN a dodatky (napríklad dane) potrebujú trojpätinovú väčšinu —{" "}
                <strong>19 z 31</strong> hlasov. Pri dani z nehnuteľností 2023 bolo za presne 18, chýbal jediný hlas —
                a rozhodlo to, že jeden poslanec z druhého tábora napokon zahlasoval za. Jeden hlas, jedna daň pre celé
                mesto. To je presne príbeh, ktorý tábory na tomto kruhu vysvetľujú.{" "}
                <Link href="/dramy" className="text-purple-400 hover:text-purple-300 underline">Pozri drámu →</Link>
              </p>
            </section>

            {/* Swing — len ak niekto naozaj lavíruje */}
            {a.swing.length > 0 && (
              <section className="bg-card rounded-2xl shadow-sm border border-line p-6">
                <div className="flex items-center gap-3 mb-2">
                  <Shuffle className="w-6 h-6 text-amber-400" aria-hidden="true" />
                  <h2 className="text-2xl font-bold text-body">Kto lavíruje medzi tábormi</h2>
                </div>
                <p className="text-sm text-muted mb-4 max-w-3xl">
                  Väčšina poslancov patrí jasne do jedného tábora. Títo nie — na sporných hlasovaniach sú zhruba
                  rovnako často s jedným aj druhým. To sú hlasy, ktoré rozhodujú tesné hlasovania.
                </p>
                <ul className="space-y-3">
                  {a.swing.map((r) => (
                    <li key={r.name} className="flex items-center gap-3">
                      <span className="w-48 shrink-0 text-sm text-body truncate">{r.name}</span>
                      <div className="flex-1 flex items-center gap-2">
                        <span className="text-xs text-emerald-500 w-20 text-right">jadro {r.corePct.toFixed(0)} %</span>
                        <div className="flex-1 h-2 rounded-full bg-elevated overflow-hidden flex">
                          <div className="h-full bg-emerald-500" style={{ width: `${r.corePct}%` }} />
                          <div className="h-full bg-red-500" style={{ width: `${r.oppPct}%` }} />
                        </div>
                        <span className="text-xs text-red-400 w-20">{r.oppPct.toFixed(0)} % opoz.</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Metodika */}
            <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl p-5 flex gap-3 items-start">
              <Info className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" aria-hidden="true" />
              <div className="text-sm text-body/90 space-y-2">
                <p>
                  <strong>Ako to čítame.</strong> Všetky čísla sú vyrátané z {a.totalVotings.toLocaleString("sk")}{" "}
                  oficiálnych menovitých hlasovaní (systém H.E.R., martin.sk). Zhoda sa počíta len z jasných hlasov{" "}
                  <em>za/proti</em> — zdržal sa, neprítomný a nehlasoval sa nerátajú.
                </p>
                <p>
                  Tábory nie sú náš názor — sú detegované algoritmom: začne najvernejšou dvojicou a priberá každého,
                  kto s celým táborom súhlasí aspoň v 97 % prípadov. Rozdelenie na kruhu vychádza zo zhody na{" "}
                  {a.contestedVotings} sporných hlasovaniach.
                </p>
                <p>
                  <strong>Toto nie je dôkaz pochybenia ani nálepka.</strong> Byť v tábore alebo v opozícii je úplne
                  legitímne — tak funguje politika. Hlasovať spolu neznamená „kúpený“ a hlasovať inak neznamená
                  „čistý“. Ukazujeme len verejný záznam prehľadne, záver si spraví čitateľ sám.
                </p>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
