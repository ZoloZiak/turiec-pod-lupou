"use client";

import SiteNav from "../components/SiteNav";
import CouncilCircle from "../components/CouncilCircle";
import { useInterrupted, ChainsList, QuorumList, WithdrawalsList } from "../components/ProceduralLists";
import SilencingOpener from "../components/SilencingOpener";
import TricksWatchlist from "../components/TricksWatchlist";
import Disclosure from "../components/Disclosure";
import Link from "next/link";
import { useState, useEffect, useMemo } from "react";
import { Network, CalendarCheck, Info, Trophy, BookOpen, ListChecks } from "lucide-react";
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
  const interrupted = useInterrupted();

  const topAttend = a?.attendance[0];

  return (
    <div className="min-h-screen bg-surface text-body pb-20">
      <SiteNav />
      <header className="bg-card text-body pt-16 pb-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <Link href="/" className="text-sm font-medium text-muted hover:text-body mb-4 block">&larr; Dashboard</Link>
          <h1 className="text-4xl font-extrabold flex items-center gap-3">
            <Network className="w-10 h-10 text-purple-400" aria-hidden="true" /> Demokratická kultúra v zastupiteľstve
          </h1>
          <p className="text-lg text-muted mt-4 max-w-3xl">
            Zastupiteľstvo nie je len o tom, kto za čo zahlasuje. Je to hlavne o tom, či sa k slovu
            dostane aj menšina, či sa veci doriešia, a či pravidlá hrajú fér. Táto stránka to
            vysvetľuje po poriadku — od úplných základov po konkrétne triky, ktoré sme našli v
            dátach. Všetko sa počíta naživo z {a ? a.totalVotings.toLocaleString("sk") : "oficiálnych"}{" "}
            menovitých hlasovaní a zo zápisníc zasadnutí.
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
            {/* ── 0. ŠAMPÓN: po lopate, čo tu nájdeš ── */}
            <section className="bg-card rounded-2xl shadow-sm border border-line p-6">
              <div className="flex items-center gap-3 mb-3">
                <BookOpen className="w-6 h-6 text-purple-400" aria-hidden="true" />
                <h2 className="text-2xl font-bold text-body">Po lopate: o čo tu ide</h2>
              </div>
              <p className="text-body/90 mb-3 max-w-3xl">
                Poslanca sme si zvolili, aby <strong className="text-body">chodil</strong>, počúval a
                rozhodoval za nás. To je jeho práca a berie za ňu plat. Preto začíname tým
                najjednoduchším: <strong className="text-body">kto na zasadnutia naozaj chodí</strong>.
              </p>
              <p className="text-body/90 mb-3 max-w-3xl">
                Potom príde to, čo nie je vidno na prvý pohľad: ako sa dá v zastupiteľstve{" "}
                <strong className="text-body">umlčať menšina</strong> a akými <strong className="text-body">trikmi</strong> sa
                dá návrh „zabiť“ bez toho, aby zaň ktokoľvek otvorene zdvihol ruku. Každý trik
                vysvetlíme jednou vetou — a kto chce detail, rozklikne si ho.
              </p>
              <p className="text-sm text-muted max-w-3xl">
                A na konci úprimne priznáme, čo ešte sledujeme, ale zatiaľ sa nám to z dát doložiť
                nepodarilo. Žiadne tvrdenie bez dôkazu.
              </p>
              <nav className="mt-5 flex flex-wrap gap-2 text-xs">
                {[
                  ["#dochadzka", "1 · Kto chodí"],
                  ["#umlcanie", "2 · Ako umlčať menšinu"],
                  ["#triky", "3 · Jednotlivé triky"],
                  ["#tabory", "4 · Dva tábory"],
                  ["#sledujeme", "5 · Čo ešte sledujeme"],
                ].map(([href, label]) => (
                  <a key={href} href={href} className="rounded-full border border-line px-3 py-1 text-muted hover:text-body hover:border-purple-400 transition-colors">
                    {label}
                  </a>
                ))}
              </nav>
            </section>

            {/* ── 1. POSLANEC MÁ HLAVNE CHODIŤ ── */}
            <section id="dochadzka" className="bg-card rounded-2xl shadow-sm border border-line p-6 scroll-mt-20">
              <div className="flex items-center gap-3 mb-2">
                <CalendarCheck className="w-6 h-6 text-blue-400" aria-hidden="true" />
                <h2 className="text-2xl font-bold text-body">1 · Poslanec má hlavne chodiť</h2>
              </div>
              <p className="text-sm text-muted mb-4 max-w-3xl">
                Najzákladnejšia vec zo všetkých. Podiel hlasovaní, pri ktorých bol poslanec prítomný,
                za celý čas jeho členstva v zastupiteľstve. Toto nie je o politike — je to o tom, kto si robí
                mandát, za ktorý berie plat. Neúčasť môže mať legitímne dôvody, preto ukazujeme aj
                počet zasadnutí, ktoré niekto <strong>vynechal celé</strong>.
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
              <Disclosure summary={`Zobraziť dochádzku všetkých ${a.attendance.length} poslancov`}>
                <ul className="space-y-2 mt-3">
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
              </Disclosure>
            </section>

            {/* ── 2. OPENER: AKO SA DÁ UMLČAŤ MENŠINA ── */}
            <div id="umlcanie" className="scroll-mt-20">
              <SilencingOpener />
            </div>

            {/* ── 3. JEDNOTLIVÉ TRIKY — jedna vrstva, dáta PRIAMO vnútri dropdownu ── */}
            <section id="triky" className="bg-card rounded-2xl shadow-sm border border-line p-6 scroll-mt-20">
              <div className="flex items-center gap-3 mb-2">
                <ListChecks className="w-6 h-6 text-rose-400" aria-hidden="true" />
                <h2 className="text-2xl font-bold text-body">3 · Jednotlivé triky, po lopate</h2>
              </div>
              <p className="text-sm text-muted mb-5 max-w-3xl">
                Päť spôsobov, ako sa dá návrh zastaviť bez toho, aby zaň niekto otvorene hlasoval
                „proti“. Každý má jednu vetu vysvetlenia — kto chce čísla a konkrétne prípady,
                rozklikne si ich priamo tu. Všetko je z verejných zápisníc a menovitých hlasovaní.
              </p>
              <div className="space-y-3">
                <Disclosure
                  tone="accent"
                  summary="① Nechať zasadnutie „vyhniť“ — predčasný koniec"
                  lead="Po dlhej rozprave sa poslanci rozídu, lavica sa preriedi a zvyšok programu padne."
                >
                  {interrupted ? (
                    <div className="mt-3 space-y-4">
                      <p className="text-xs text-muted max-w-3xl">
                        Za toto obdobie sa <strong className="text-body">{interrupted.interruptedMeetings}</strong> z{" "}
                        <strong className="text-body">{interrupted.scheduledMeetings}</strong> riadnych
                        zasadnutí nepodarilo dokončiť v jeden deň — vyžiadali si{" "}
                        <strong className="text-body">{interrupted.continuationDays}</strong> ďalších
                        rokovacích termínov. Vidno to z hlavičiek úradných uznesení („pokračovanie MsZ z…“).
                      </p>
                      <ChainsList chains={interrupted.chains} />
                    </div>
                  ) : (
                    <p className="text-xs text-muted mt-3">Načítavam dáta…</p>
                  )}
                </Disclosure>

                <Disclosure
                  tone="accent"
                  summary="② Nechať padnúť kvórum priamo v sále"
                  lead="Keď časť poslancov odíde, zbor prestane byť uznášaniaschopný a o zvyšku sa už nehlasuje."
                >
                  {interrupted?.quorumFailures && interrupted.quorumFailures.length > 0 ? (
                    <div className="mt-3 space-y-4">
                      <p className="text-xs text-muted max-w-3xl">
                        Zastupiteľstvo môže hlasovať, len kým je v sále dosť poslancov. Keď kvórum padne,
                        o zvyšných bodoch sa už nehlasuje — zápisnica to zachytáva doslovne. Stalo sa to{" "}
                        <strong className="text-body">{interrupted.quorumFailures.length}×</strong>.
                        Od zmeny pravidla (viď sekcia 2 vyššie) to zakaždým znamená koniec, nie odklad.
                      </p>
                      <QuorumList items={interrupted.quorumFailures} src={interrupted.quorumSrc} />
                    </div>
                  ) : (
                    <p className="text-xs text-muted mt-3">Načítavam dáta…</p>
                  )}
                </Disclosure>

                <Disclosure
                  tone="accent"
                  summary="③ Vyhodiť bod z programu hneď na úvod"
                  lead="Pri schvaľovaní programu sa dá navrhnúť, aby sa niektorý bod vôbec neprerokúval."
                >
                  {interrupted?.withdrawals && interrupted.withdrawals.length > 0 ? (
                    <div className="mt-3 space-y-4">
                      <p className="text-xs text-muted max-w-3xl">
                        Keď to zbor odhlasuje, bod spadne zo stola bez vecnej diskusie. Takých návrhov
                        zo zápisníc vychádza <strong className="text-body">{interrupted.withdrawals.length}</strong>{" "}
                        — tu je, kto ich podal a ako dopadli.
                      </p>
                      <WithdrawalsList items={interrupted.withdrawals} />
                      {typeof interrupted.amendmentsTotal === "number" && interrupted.amendmentsTotal > 0 && (
                        <p className="text-xs text-muted max-w-3xl border-t border-line/70 pt-3">
                          <strong className="text-body">Príbuzný trik — prerobiť návrh na mieste:</strong>{" "}
                          zápisnice za toto obdobie zachytávajú{" "}
                          <strong className="text-body">{interrupted.amendmentsTotal}</strong> pozmeňujúcich
                          a protinávrhov (v {interrupted.amendmentsMeetings} zasadnutiach). Menný rozklad
                          zámerne neuvádzame, aby z toho nevznikli nepresné tvrdenia; detaily sú v zápisniciach.
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-muted mt-3">Načítavam dáta…</p>
                  )}
                </Disclosure>

                <Disclosure
                  tone="accent"
                  summary="④ Nafúknuť kvórum — zaprezentovať sa, ale nehlasovať"
                  lead="Poslanec sa prezentuje (ráta sa do kvóra), no pri hlasovaní nestlačí nič — pomôže väčšine a nenesie zodpovednosť."
                >
                  <div className="mt-3 space-y-3">
                    <p className="text-xs text-muted max-w-3xl">
                      Opačná strana mince k trikom vyššie: nie „zabiť návrh“, ale „nechať prejsť bez
                      vlastného podpisu“. Za toto obdobie sa to stalo v{" "}
                      <strong className="text-body">{a.presentNotVoting}</strong> hlasovaniach, kde sa
                      aspoň jeden poslanec zaprezentoval, ale pri samotnom hlasovaní nestlačil nič.
                    </p>
                    <p className="text-xs text-muted max-w-3xl">
                      Má to priamy dôsledok: návrh môže padnúť, aj keď má viac hlasov za ako proti —
                      lebo kvórum sa ráta z prítomných. Za obdobie tak na kvóre padlo{" "}
                      <strong className="text-body">{a.failed.length}</strong>{" "}
                      {a.failed.length === 1 ? "menovité hlasovanie" : a.failed.length < 5 ? "menovité hlasovania" : "menovitých hlasovaní"}.
                      {a.failed[0] && (
                        <> Najznámejší prípad: <strong className="text-body">daň z nehnuteľností 2023</strong>{" "}
                        — chýbal jediný hlas, o päť týždňov tá istá daň prešla.</>
                      )}
                    </p>
                    <p className="text-xs text-muted">
                      Celý menný rozpis — kto bol proti, kto sa zdržal, kde chýbal jeden hlas a kto
                      otočil — je prehľadne na stránke{" "}
                      <Link href="/dramy" className="text-purple-400 hover:text-purple-300 underline font-medium">
                        Drámy zastupiteľstva →
                      </Link>
                      , aby sme tu to isté neopakovali.
                    </p>
                  </div>
                </Disclosure>

                <Disclosure
                  tone="accent"
                  summary="⑤ Zmeniť samotné pravidlá rokovania"
                  lead="Najmocnejší nástroj: prepísať rokovací poriadok tak, aby pravidlá hrali v prospech väčšiny."
                >
                  <div className="mt-3 space-y-3">
                    <p className="text-xs text-muted max-w-3xl">
                      Napríklad že padnuté kvórum = koniec, nie odklad (viď sekcia 2). Za toto obdobie
                      sa rokovací poriadok menil <strong className="text-body">dvakrát</strong> — Dodatok
                      č. 3 (jún 2024) a Dodatok č. 4 (marec 2025) — a pri oboch stála pevne proti{" "}
                      <strong className="text-body">celá jedenásťčlenná opozícia</strong>. Prešli len
                      tesne, nadpolovičnou väčšinou prítomných.
                    </p>
                    <p className="text-xs text-muted">
                      Obe hlasovania aj s menným rozpisom a tým, ako tesne pri hranici skončili, nájdeš
                      na stránke{" "}
                      <Link href="/dramy" className="text-purple-400 hover:text-purple-300 underline font-medium">
                        Drámy zastupiteľstva →
                      </Link>
                      , aby sme tu to isté neopakovali.
                    </p>
                  </div>
                </Disclosure>
              </div>
            </section>

            {/* ── 4. DVA TÁBORY (kontext — kto s kým drží) ── */}
            <section id="tabory" className="bg-card rounded-2xl shadow-sm border border-line p-6 scroll-mt-20">
              <div className="flex items-center gap-3 mb-2">
                <Network className="w-6 h-6 text-purple-400" aria-hidden="true" />
                <h2 className="text-2xl font-bold text-body">4 · Dva tábory v zastupiteľstve</h2>
              </div>
              <p className="text-sm text-muted mb-2 max-w-3xl">
                Aby triky vyššie dávali zmysel, treba vidieť, kto s kým drží. Každá bodka je poslanec.
                Čiara spája dvoch, ktorí <strong>na sporných hlasovaniach</strong> hlasujú rovnako
                (aspoň v 80 % prípadov). Keď sa čiary zoskupia do dvoch chumáčov, zastupiteľstvo má
                dva tábory — a presne to tu vidno: {a.blocSize} v jednom, {a.oppSize} v druhom. Nikoho
                sme do tábora nezaradili ručne — vypočítal to algoritmus zo zhody hlasov.
              </p>
              <p className="text-xs text-muted mb-4 max-w-3xl">
                Dôležité: berieme len {a.contestedVotings} <strong>sporných</strong> hlasovaní (kde sa
                zastupiteľstvo rozdelilo), nie rutinu, kde sú si všetci jednotní. Tam sa totiž tábory
                ukážu najčistejšie.
              </p>
              <CouncilCircle nodes={a.circle.nodes} edges={a.circle.edges} />

              <div className="mt-6">
                <Disclosure summary="Je martinské zastupiteľstvo vlastne rozhádané?">
                  <p className="text-body/90 mt-3">
                    Na prvý pohľad nie — až <strong className="text-emerald-500">{a.unanimousShare.toFixed(0)} %</strong>{" "}
                    hlasovaní prejde takmer jednomyseľne. Väčšina rozhodnutí je nespornou rutinou.
                    Napätie je v tých pár percentách, kde ide o peniaze alebo princíp — a práve tam sa
                    ukáže, že tábory existujú a držia spolu prekvapivo pevne.
                  </p>
                  <p className="text-body/90 mt-3">
                    A deliace čiary majú reálne dôsledky. VZN a dodatky (napríklad dane) potrebujú
                    trojpätinovú väčšinu <strong>prítomných</strong> poslancov. Pri dani z nehnuteľností
                    2023 sedelo v sále všetkých 31, takže hranica bola <strong>19 hlasov</strong> — a za
                    bolo presne 18, chýbal jediný hlas. Napokon rozhodlo, že jeden poslanec z druhého
                    tábora pri opakovanom hlasovaní zahlasoval za. Jeden hlas, jedna daň pre celé mesto.{" "}
                    <Link href="/dramy" className="text-purple-400 hover:text-purple-300 underline">Pozri drámu →</Link>
                  </p>
                </Disclosure>
              </div>

              {a.swing.length > 0 && (
                <div className="mt-3">
                  <Disclosure summary="Kto lavíruje medzi tábormi (rozhoduje tesné hlasovania)">
                    <p className="text-sm text-muted mt-3 mb-4 max-w-3xl">
                      Väčšina poslancov patrí jasne do jedného tábora. Títo nie — na sporných
                      hlasovaniach sú zhruba rovnako často s jedným aj druhým. To sú hlasy, ktoré
                      rozhodujú tesné hlasovania.
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
                  </Disclosure>
                </div>
              )}
            </section>

            {/* ── 5. ČO SLEDUJEME, ALE ZATIAĽ NEVIDÍME ── */}
            <div id="sledujeme" className="scroll-mt-20">
              <TricksWatchlist />
            </div>

            {/* Metodika */}
            <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl p-5 flex gap-3 items-start">
              <Info className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" aria-hidden="true" />
              <div className="text-sm text-body/90 space-y-2">
                <p>
                  <strong>Ako to čítame.</strong> Všetky čísla sú vyrátané z {a.totalVotings.toLocaleString("sk")}{" "}
                  oficiálnych menovitých hlasovaní (systém H.E.R., martin.sk) a zo zápisníc zasadnutí.
                  Zhoda sa počíta len z jasných hlasov <em>za/proti</em> — zdržal sa, neprítomný a
                  nehlasoval sa nerátajú.
                </p>
                <p>
                  Tábory nie sú náš názor — sú detegované algoritmom: začne najvernejšou dvojicou a
                  priberá každého, kto s celým táborom súhlasí aspoň v 97 % prípadov. Rozdelenie na
                  kruhu vychádza zo zhody na {a.contestedVotings} sporných hlasovaniach.
                </p>
                <p>
                  <strong>Toto nie je dôkaz pochybenia ani nálepka.</strong> Byť v tábore alebo v
                  opozícii je úplne legitímne — tak funguje politika. Hlasovať spolu neznamená
                  „kúpený“ a hlasovať inak neznamená „čistý“. Procedurálne nástroje tiež nie sú samy
                  o sebe nezákonné — ukazujeme len verejný záznam prehľadne a po lopate, záver si
                  spraví čitateľ sám.
                </p>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
