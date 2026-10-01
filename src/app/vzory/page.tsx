"use client";

import SiteNav from "../components/SiteNav";
import Link from "next/link";
import { useState, useEffect, useMemo } from "react";
import { Network, Users2, UserMinus, CalendarCheck, Handshake, Info } from "lucide-react";
import { CouncilData, analyze, Analysis } from "../../lib/councilVotes";

function Bar({ pct, tone }: { pct: number; tone: "red" | "emerald" | "amber" | "purple" }) {
  const bg =
    tone === "red" ? "bg-red-500" : tone === "emerald" ? "bg-emerald-500" : tone === "amber" ? "bg-amber-400" : "bg-purple-500";
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
            hlasovaní zastupiteľstva sme vyrátali, kto drží spolu, kto je opozícia, kto láme vlastný tábor a kto najviac
            chýba. Všetko sa počíta naživo z dát — keď pribudne zasadnutie, čísla sa prepočítajú samy.
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
            {/* Zhrnutie: ako velmi je rada rozdelena */}
            <section className="bg-card rounded-2xl shadow-sm border border-line p-6">
              <h2 className="text-xl font-bold text-body mb-2">Je martinská rada rozdelená?</h2>
              <p className="text-body/90">
                Skôr nie. Až <strong className="text-emerald-500">{a.unanimousShare.toFixed(0)} %</strong> hlasovaní prejde
                takmer jednomyseľne (zhoda nad 95 %). Väčšina rozhodnutí je nespornou rutinou — zaujímavé je tých pár
                percent, kde sa rada rozdelí. Napriek tomu existuje jasné jadro, ktoré drží spolu takmer vždy, a skupina,
                ktorá sa od neho pravidelne odkláňa.
              </p>
            </section>

            {/* Koalicny blok */}
            <section className="bg-card rounded-2xl shadow-sm border border-line p-6">
              <div className="flex items-center gap-3 mb-2">
                <Users2 className="w-6 h-6 text-emerald-400" aria-hidden="true" />
                <h2 className="text-2xl font-bold text-body">Jadro, ktoré drží spolu</h2>
              </div>
              <p className="text-sm text-muted mb-4 max-w-3xl">
                {a.bloc.length} poslancov, ktorí hlasujú zhodne medzi sebou v <strong>97 % a viac</strong> prípadov.
                Toto je efektívna väčšina rady — keď sa dohodnú, návrh prejde. Blok nie je zadaný ručne, je{" "}
                <strong>vypočítaný</strong> zo vzájomnej zhody hlasov.
              </p>
              <div className="flex flex-wrap gap-2">
                {a.bloc.map((n) => (
                  <span key={n} className="px-3 py-1 rounded-full text-sm font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                    {n}
                  </span>
                ))}
              </div>
              <p className="text-xs text-muted mt-4">
                Pozn.: VZN a dodatky potrebujú trojpätinovú väčšinu (19 z 31). Jadro {a.bloc.length} hlasov preto na VZN
                samo nestačí — to vysvetľuje, prečo daň z nehnuteľností 2023 padla, kým jeden z opozície neotočil hlas.{" "}
                <Link href="/dramy" className="text-purple-400 hover:text-purple-300 underline">Pozri drámu →</Link>
              </p>
            </section>

            {/* Opozicia */}
            <section className="bg-card rounded-2xl shadow-sm border border-line p-6">
              <div className="flex items-center gap-3 mb-2">
                <UserMinus className="w-6 h-6 text-red-400" aria-hidden="true" />
                <h2 className="text-2xl font-bold text-body">Kto najčastejšie hlasuje proti väčšine</h2>
              </div>
              <p className="text-sm text-muted mb-4 max-w-3xl">
                Podiel hlasovaní, kde poslanec hlasoval opačne než napokon vyšla väčšina (počíta sa len z jasných
                hlasov za/proti). Vysoké číslo = stála opozícia, nie pochybenie.
              </p>
              <ul className="space-y-2">
                {a.opposition.slice(0, 10).map((r) => (
                  <li key={r.name} className="flex items-center gap-3">
                    <span className="w-48 shrink-0 text-sm text-body truncate">{r.name}</span>
                    <Bar pct={r.pct} tone="red" />
                    <span className="w-28 shrink-0 text-right text-xs text-muted">
                      {r.pct.toFixed(1)} % ({r.count}/{r.total})
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            {/* Dvojice */}
            <section className="bg-card rounded-2xl shadow-sm border border-line p-6">
              <div className="flex items-center gap-3 mb-2">
                <Handshake className="w-6 h-6 text-purple-400" aria-hidden="true" />
                <h2 className="text-2xl font-bold text-body">Kto s kým hlasuje rovnako</h2>
              </div>
              <p className="text-sm text-muted mb-4 max-w-3xl">
                Dvojice s najvyššou zhodou hlasov (min. 150 spoločných hlasovaní). Stopercentná zhoda cez stovky
                hlasovaní je silný znak jedného tábora.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {a.pairs.slice(0, 8).map((p) => (
                  <div key={`${p.a}-${p.b}`} className="flex items-center justify-between gap-2 rounded-lg border border-line px-3 py-2">
                    <span className="text-sm text-body truncate">{p.a} <span className="text-muted">⟷</span> {p.b}</span>
                    <span className="text-xs font-bold text-emerald-500 shrink-0">{p.pct.toFixed(1)} %</span>
                  </div>
                ))}
              </div>
            </section>

            {/* Kto lame tabor */}
            <section className="bg-card rounded-2xl shadow-sm border border-line p-6">
              <div className="flex items-center gap-3 mb-2">
                <Network className="w-6 h-6 text-amber-400" aria-hidden="true" />
                <h2 className="text-2xl font-bold text-body">Kto najčastejšie hlasuje inak než jadro</h2>
              </div>
              <p className="text-sm text-muted mb-4 max-w-3xl">
                Z poslancov mimo koaličného jadra — ako často hlasovali inak než jeho prevažujúci postoj. To sú
                rozhodujúce (swing) hlasy, ktoré lámu tesné hlasovania (ako Jozef Petráš pri dani).
              </p>
              <ul className="space-y-2">
                {a.defectors.slice(0, 10).map((r) => (
                  <li key={r.name} className="flex items-center gap-3">
                    <span className="w-48 shrink-0 text-sm text-body truncate">{r.name}</span>
                    <Bar pct={r.pct} tone="amber" />
                    <span className="w-28 shrink-0 text-right text-xs text-muted">
                      {r.pct.toFixed(1)} % ({r.count}/{r.total})
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            {/* Dochadzka */}
            <section className="bg-card rounded-2xl shadow-sm border border-line p-6">
              <div className="flex items-center gap-3 mb-2">
                <CalendarCheck className="w-6 h-6 text-blue-400" aria-hidden="true" />
                <h2 className="text-2xl font-bold text-body">Účasť na hlasovaniach</h2>
              </div>
              <p className="text-sm text-muted mb-4 max-w-3xl">
                Podiel hlasovaní, pri ktorých bol poslanec prítomný (odhlasoval za/proti/zdržal sa alebo nehlasoval),
                z celého času, kým bol členom rady. Neúčasť môže mať legitímne dôvody — je to údaj, nie súd.
              </p>
              <ul className="space-y-2">
                {a.attendance.map((r) => (
                  <li key={r.name} className="flex items-center gap-3">
                    <span className="w-48 shrink-0 text-sm text-body truncate">{r.name}</span>
                    <Bar pct={r.presentPct} tone={r.presentPct >= 80 ? "emerald" : r.presentPct >= 60 ? "amber" : "red"} />
                    <span className="w-28 shrink-0 text-right text-xs text-muted">
                      {r.presentPct.toFixed(0)} % ({r.present}/{r.member})
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            {/* Metodika */}
            <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl p-5 flex gap-3 items-start">
              <Info className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" aria-hidden="true" />
              <div className="text-sm text-body/90 space-y-2">
                <p>
                  <strong>Ako to čítame.</strong> Všetky čísla sú vyrátané z {a.totalVotings.toLocaleString("sk")}{" "}
                  oficiálnych menovitých hlasovaní (systém H.E.R., martin.sk). Pojmy „zhoda“ a „opozícia“ sa počítajú len
                  z jasných hlasov <em>za/proti</em> — zdržal sa, neprítomný a nehlasoval sa do nich nerátajú.
                </p>
                <p>
                  Koaličné jadro nie je náš názor — je to skupina detegovaná algoritmom: začne najvernejšou dvojicou
                  a priberá každého, kto má aspoň 97 % zhodu so všetkými jej členmi.
                </p>
                <p>
                  <strong>Toto nie je dôkaz pochybenia.</strong> Hlasovať s táborom, proti nemu, alebo chýbať — všetko
                  môže mať legitímne dôvody. Ukazujeme verejný záznam prehľadne, záver si spraví čitateľ.
                </p>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
