"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from "recharts";
import {
  LineChart as LineChartIcon, TrendingUp, CalendarClock, Gauge, Flame,
  ArrowUpRight, ExternalLink, Info, ShieldAlert, Trophy,
} from "lucide-react";

// ── Typy (zhoda s /api/data) ─────────────────────────────────────────────
type Entity = { name: string; ico: string };
type Tx = {
  id: string;
  external_id?: string;
  source_type: "CRZ_CONTRACT" | "WEB_INVOICE";
  amount_eur: number;
  subject: string;
  date_published: string;
  source_url?: string;
  buyer?: Entity;
  supplier?: Entity;
  is_income?: boolean;
};
type ApiData = { success: boolean; transactions: Tx[]; entities: Entity[] };

const formatEur = (v: number) =>
  new Intl.NumberFormat("sk-SK", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);
const formatEurFull = (v: number) =>
  new Intl.NumberFormat("sk-SK", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(v);

const num = (v: unknown) => Number(v) || 0;
const crzUrl = (t: Tx) =>
  t.source_url ? (t.source_url.startsWith("http") ? t.source_url : `https://${t.source_url}`) : null;

// Minimálny počet zmlúv, aby mal index štatistický zmysel (menej = artefakt).
const MIN_TX_FOR_INDEX = 20;

export default function AnalyzyPage() {
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/data");
        const json = await res.json();
        if (json.success) setData(json);
      } catch {
        /* prázdny stav nižšie */
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const analysis = useMemo(() => {
    if (!data) return null;
    const entityIcos = new Set(data.entities.map((e) => e.ico));
    // Výdavky = všetko okrem príjmov (NFP/dotácie mestu).
    const expenses = data.transactions.filter((t) => !t.is_income);

    // 1) TREND po rokoch
    const yearMap = new Map<string, { total: number; count: number }>();
    for (const t of expenses) {
      const y = t.date_published?.slice(0, 4);
      if (!y) continue;
      const e = yearMap.get(y) || { total: 0, count: 0 };
      e.total += num(t.amount_eur);
      e.count += 1;
      yearMap.set(y, e);
    }
    const trend = [...yearMap.entries()]
      .map(([rok, v]) => ({ rok, total: Math.round(v.total), count: v.count }))
      .sort((a, b) => a.rok.localeCompare(b.rok));

    // 2) DECEMBROVÝ ZHON po rokoch
    const december = trend.map(({ rok }) => {
      const decTotal = expenses
        .filter((t) => t.date_published?.slice(0, 4) === rok && t.date_published?.slice(5, 7) === "12")
        .reduce((s, t) => s + num(t.amount_eur), 0);
      const yearTotal = yearMap.get(rok)?.total || 0;
      return { rok, dec: Math.round(decTotal), share: yearTotal ? (decTotal / yearTotal) * 100 : 0 };
    });

    // 3) INDEX per mestská organizácia (buyer je sledovaný subjekt)
    // KĽÚČOVÉ: rozlíš IN-HOUSE (dodávateľ = iný mestský podnik) od EXTERNÝCH.
    // Koncentrácia u vlastného podniku je legitímny vnútromestský transfer, NIE riziko —
    // HHI preto rátame LEN z externých dodávateľov.
    type OrgAgg = {
      ico: string; name: string; total: number; count: number; dec: number; big: number;
      extTotal: number; inhouseTotal: number;
      extSuppliers: Map<string, number>;
    };
    const orgs = new Map<string, OrgAgg>();
    for (const t of expenses) {
      const b = t.buyer;
      if (!b || !entityIcos.has(b.ico)) continue;
      const o = orgs.get(b.ico) || { ico: b.ico, name: b.name, total: 0, count: 0, dec: 0, big: 0, extTotal: 0, inhouseTotal: 0, extSuppliers: new Map() };
      const amt = num(t.amount_eur);
      o.total += amt;
      o.count += 1;
      if (t.date_published?.slice(5, 7) === "12") o.dec += amt;
      if (amt >= 100000) o.big += 1;
      const isInhouse = t.supplier && entityIcos.has(t.supplier.ico);
      if (isInhouse) {
        o.inhouseTotal += amt;
      } else if (t.supplier) {
        o.extTotal += amt;
        o.extSuppliers.set(t.supplier.name, (o.extSuppliers.get(t.supplier.name) || 0) + amt);
      }
      orgs.set(b.ico, o);
    }
    const orgIndex = [...orgs.values()]
      .filter((o) => o.total > 0)
      .map((o) => {
        // HHI koncentrácie LEN externých dodávateľov (0–1); vyšší = menšia súťaž.
        const hhi = o.extTotal > 0
          ? [...o.extSuppliers.values()].reduce((s, v) => s + Math.pow(v / o.extTotal, 2), 0)
          : 0;
        const decShare = o.total ? o.dec / o.total : 0;
        const bigShare = o.count ? o.big / o.count : 0;
        const inhouseShare = o.total ? o.inhouseTotal / o.total : 0;
        // Index rizikových vzorcov 0–100 (transparentná lin. kombinácia; NIE obvinenie).
        const score = Math.round(Math.min(100, hhi * 55 + decShare * 30 + bigShare * 15));
        const topSupplier = [...o.extSuppliers.entries()].sort((a, b) => b[1] - a[1])[0] || ["—", 0];
        return {
          ...o,
          hhi,
          decShare: decShare * 100,
          bigShare: bigShare * 100,
          inhouseShare: inhouseShare * 100,
          score,
          topSupplierName: topSupplier[0],
          topSupplierShare: o.extTotal ? (topSupplier[1] / o.extTotal) * 100 : 0,
          // Index má zmysel len keď má org dosť EXTERNÝCH zmlúv (in-house netreba súťažiť).
          enoughData: o.extSuppliers.size > 0 && o.count >= MIN_TX_FOR_INDEX,
        };
      })
      .sort((a, b) => b.total - a.total);

    // 4) ANOMÁLIE (fakty, každá s overiteľným odkazom)
    const anomalies: {
      icon: "big" | "concentration" | "december" | "oneoff";
      title: string;
      detail: string;
      href?: string | null;
      hrefLabel?: string;
    }[] = [];

    // 4a) najväčšia jednotlivá zmluva
    const biggest = [...expenses].sort((a, b) => num(b.amount_eur) - num(a.amount_eur))[0];
    if (biggest) {
      anomalies.push({
        icon: "big",
        title: "Najväčšia jednotlivá zmluva",
        detail: `${formatEurFull(num(biggest.amount_eur))} — ${biggest.supplier?.name || "neznámy dodávateľ"}. Predmet: ${biggest.subject?.slice(0, 90) || "—"}.`,
        href: crzUrl(biggest),
        hrefLabel: "Otvoriť zmluvu v CRZ",
      });
    }

    // 4b) rok s najvyšším decembrovým zhonom
    const worstDec = [...december].filter((d) => d.share > 0).sort((a, b) => b.share - a.share)[0];
    if (worstDec && worstDec.share >= 20) {
      anomalies.push({
        icon: "december",
        title: `Koncoročný zhon v roku ${worstDec.rok}`,
        detail: `V decembri ${worstDec.rok} bolo zazmluvnených ${formatEur(worstDec.dec)} — ${worstDec.share.toFixed(0)} % výdavkov celého roka. Typický vzorec „minúť rozpočet do konca roka“.`,
      });
    }

    // 4c) najkoncentrovanejšia organizácia u EXTERNÝCH dodávateľov (s dostatkom dát)
    const mostConcentrated = orgIndex.filter((o) => o.enoughData).sort((a, b) => b.hhi - a.hhi)[0];
    if (mostConcentrated && mostConcentrated.topSupplierShare >= 30) {
      anomalies.push({
        icon: "concentration",
        title: "Najvyššia koncentrácia externých dodávateľov",
        detail: `${mostConcentrated.name}: ${mostConcentrated.topSupplierShare.toFixed(0)} % externých výdavkov smeruje k jednému súkromnému dodávateľovi (${mostConcentrated.topSupplierName}). Nižšia súťaž — nemusí byť pochybenie, ale stojí za pozornosť. Zmluvy s vlastnými mestskými podnikmi sa do tohto čísla nerátajú.`,
      });
    }

    // 4d) jednorazový veľký dodávateľ (1 zmluva, veľká suma)
    const supMap = new Map<string, { total: number; count: number; ico?: string }>();
    for (const t of expenses) {
      if (!t.supplier) continue;
      const s = supMap.get(t.supplier.name) || { total: 0, count: 0, ico: t.supplier.ico };
      s.total += num(t.amount_eur);
      s.count += 1;
      supMap.set(t.supplier.name, s);
    }
    const oneOff = [...supMap.entries()]
      .filter(([, s]) => s.count === 1 && s.total >= 1000000)
      .sort((a, b) => b[1].total - a[1].total)[0];
    if (oneOff) {
      anomalies.push({
        icon: "oneoff",
        title: "Veľký jednorazový dodávateľ",
        detail: `${oneOff[0]} dostal ${formatEur(oneOff[1].total)} v jedinej zmluve a v databáze nemá žiadnu ďalšiu. Overte účel a súťaž.`,
        href: oneOff[1].ico ? `/dodavatel/${oneOff[1].ico}` : null,
        hrefLabel: "Profil dodávateľa",
      });
    }

    const totalExpenses = expenses.reduce((s, t) => s + num(t.amount_eur), 0);
    return { trend, december, orgIndex, anomalies, totalExpenses, txCount: expenses.length };
  }, [data]);

  return (
    <div className="min-h-screen bg-surface text-body font-sans pb-20">
      {/* HEADER */}
      <header className="bg-card border-b border-line pt-10 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <Link href="/" className="text-sm font-medium text-muted hover:text-body mb-4 block">
            &larr; Dashboard
          </Link>
          <h1 className="text-3xl sm:text-4xl font-extrabold flex items-center gap-3">
            <LineChartIcon className="w-9 h-9 text-emerald-400" aria-hidden="true" /> Analýzy a anomálie
          </h1>
          <p className="text-base sm:text-lg text-muted mt-4 max-w-3xl">
            Automatické štatistické analýzy z overených zmlúv (Centrálny register zmlúv). Vývoj výdavkov v čase,
            koncoročné zhony, koncentrácia dodávateľov a index rizikových vzorcov mestských organizácií.
            Každé číslo pochádza z dát, ktoré si viete overiť.
          </p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8 space-y-10">
        {loading || !analysis ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
          </div>
        ) : (
          <>
            {/* SUHRN */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-card border border-line rounded-2xl p-6">
                <p className="text-xs font-bold uppercase tracking-widest text-muted mb-2">Analyzované výdavky</p>
                <div className="text-3xl font-black text-body">{formatEur(analysis.totalExpenses)}</div>
              </div>
              <div className="bg-card border border-line rounded-2xl p-6">
                <p className="text-xs font-bold uppercase tracking-widest text-muted mb-2">Zmlúv v analýze</p>
                <div className="text-3xl font-black text-body">{analysis.txCount.toLocaleString("sk-SK")}</div>
              </div>
              <div className="bg-card border border-line rounded-2xl p-6">
                <p className="text-xs font-bold uppercase tracking-widest text-muted mb-2">Sledovaných organizácií</p>
                <div className="text-3xl font-black text-body">{analysis.orgIndex.length}</div>
              </div>
            </div>

            {/* 1) TREND V ČASE */}
            <section className="bg-card border border-line rounded-2xl p-6 shadow-lg">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-5 h-5 text-emerald-400" aria-hidden="true" />
                <h2 className="text-xl font-bold text-body">Vývoj výdavkov v čase</h2>
              </div>
              <p className="text-sm text-muted mb-6">
                Objem zazmluvnených výdavkov (mesto + podniky) podľa roku zverejnenia. Roky s neúplnými dátami
                na začiatku registra (2021–2022) majú prirodzene nižšie hodnoty.
              </p>
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={analysis.trend} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity={0.5} />
                        <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--line)" />
                    <XAxis dataKey="rok" axisLine={false} tickLine={false} tick={{ fill: "var(--muted)", fontWeight: 600 }} />
                    <YAxis
                      axisLine={false} tickLine={false} tick={{ fill: "var(--muted)", fontSize: 12 }} width={70}
                      tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)} M€`}
                    />
                    <Tooltip
                      cursor={{ stroke: "var(--line)" }}
                      contentStyle={{ borderRadius: 12, background: "var(--card)", border: "1px solid var(--line)", color: "var(--body)" }}
                      labelStyle={{ color: "var(--body)", fontWeight: 700 }}
                      formatter={(v: number, _n, p) => [`${formatEur(v)} — ${(p?.payload?.count ?? 0)} zmlúv`, "Výdavky"]}
                    />
                    <Area type="monotone" dataKey="total" stroke="#10b981" strokeWidth={2.5} fill="url(#trendFill)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </section>

            {/* 2) DECEMBROVÝ ZHON */}
            <section className="bg-card border border-line rounded-2xl p-6 shadow-lg">
              <div className="flex items-center gap-2 mb-1">
                <CalendarClock className="w-5 h-5 text-purple-400" aria-hidden="true" />
                <h2 className="text-xl font-bold text-body">Koncoročný zhon (December)</h2>
              </div>
              <p className="text-sm text-muted mb-6">
                Aký podiel ročných výdavkov sa zazmluvní až v decembri. Vysoké hodnoty naznačujú dočerpávanie
                rozpočtu na konci roka — legitímne aj rizikové, preto stojí za pozornosť.
              </p>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analysis.december} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--line)" />
                    <XAxis dataKey="rok" axisLine={false} tickLine={false} tick={{ fill: "var(--muted)", fontWeight: 600 }} />
                    <YAxis
                      axisLine={false} tickLine={false} tick={{ fill: "var(--muted)", fontSize: 12 }} width={45}
                      tickFormatter={(v) => `${v}%`} domain={[0, 100]}
                    />
                    <Tooltip
                      cursor={{ fill: "var(--elevated)" }}
                      contentStyle={{ borderRadius: 12, background: "var(--card)", border: "1px solid var(--line)", color: "var(--body)" }}
                      labelStyle={{ color: "var(--body)", fontWeight: 700 }}
                      formatter={(v: number, _n, p) => [`${v.toFixed(0)} % (${formatEur(p?.payload?.dec ?? 0)})`, "Podiel decembra"]}
                    />
                    <Bar dataKey="share" radius={[6, 6, 0, 0]} barSize={44}>
                      {analysis.december.map((d, i) => (
                        <Cell key={i} fill={d.share >= 30 ? "#f87171" : d.share >= 15 ? "#fbbf24" : "#a78bfa"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            {/* 3) INDEX RIZIKOVÝCH VZORCOV */}
            <section className="bg-card border border-line rounded-2xl p-6 shadow-lg">
              <div className="flex items-center gap-2 mb-1">
                <Gauge className="w-5 h-5 text-amber-400" aria-hidden="true" />
                <h2 className="text-xl font-bold text-body">Index rizikových vzorcov (podľa organizácie)</h2>
              </div>
              <div className="text-sm text-muted mb-5 flex gap-3 items-start bg-elevated/60 border border-line rounded-xl p-4">
                <Info className="w-5 h-5 shrink-0 mt-0.5 text-amber-400" aria-hidden="true" />
                <div>
                  <strong className="text-body">Ako čítať index:</strong> 0–100, kde vyššie číslo znamená viac
                  rizikových vzorcov v <em>štruktúre</em> zmlúv organizácie. Skladá sa z koncentrácie
                  <strong className="text-body"> externých</strong> dodávateľov (HHI, váha 55), koncoročného zhonu (30)
                  a podielu veľkých zmlúv nad 100&nbsp;tis.&nbsp;€ (15). Zmluvy medzi mestom a jeho vlastnými
                  podnikmi (in-house) sú z koncentrácie <strong className="text-body">vylúčené</strong> — je to
                  legitímny vnútromestský transfer, nie znak nižšej súťaže.
                  <span className="text-amber-300"> Toto NIE je dôkaz pochybenia</span> — je to štatistický ukazovateľ
                  na ďalšie skúmanie. Organizácie bez externých zmlúv alebo s menej než {MIN_TX_FOR_INDEX} zmluvami
                  index nedostávajú („málo dát“).
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-muted uppercase border-b border-line">
                    <tr>
                      <th className="px-3 py-3 font-medium">Organizácia</th>
                      <th className="px-3 py-3 font-medium text-right">Výdavky</th>
                      <th className="px-3 py-3 font-medium text-right">In-house</th>
                      <th className="px-3 py-3 font-medium text-right">Koncentr. (ext.)</th>
                      <th className="px-3 py-3 font-medium text-right">Zhon XII</th>
                      <th className="px-3 py-3 font-medium text-right">Veľké zml.</th>
                      <th className="px-3 py-3 font-medium text-right">Index</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {analysis.orgIndex.map((o) => {
                      const color = o.score >= 55 ? "text-red-400 bg-red-500/10 border-red-500/30"
                        : o.score >= 35 ? "text-amber-300 bg-amber-500/10 border-amber-500/30"
                        : "text-emerald-400 bg-emerald-500/10 border-emerald-500/30";
                      return (
                        <tr key={o.ico} className="hover:bg-elevated/50 transition-colors">
                          <td className="px-3 py-3">
                            <div className="font-semibold text-body">{o.name}</div>
                            <div className="text-xs text-muted mt-0.5">
                              {o.count} zmlúv{o.topSupplierName !== "—" && <> · top ext.: {o.topSupplierName} ({o.topSupplierShare.toFixed(0)} %)</>}
                              {!o.enoughData && <span className="ml-2 text-amber-400">· málo dát</span>}
                            </div>
                          </td>
                          <td className="px-3 py-3 text-right font-mono text-body">{formatEur(o.total)}</td>
                          <td className="px-3 py-3 text-right font-mono text-muted">{o.inhouseShare >= 1 ? `${o.inhouseShare.toFixed(0)} %` : "—"}</td>
                          <td className="px-3 py-3 text-right font-mono text-muted">{o.enoughData ? o.hhi.toFixed(2) : "—"}</td>
                          <td className="px-3 py-3 text-right font-mono text-muted">{o.decShare.toFixed(0)} %</td>
                          <td className="px-3 py-3 text-right font-mono text-muted">{o.big}</td>
                          <td className="px-3 py-3 text-right">
                            {o.enoughData ? (
                              <span className={`inline-block min-w-[2.5rem] font-bold px-2 py-1 rounded-lg border ${color}`}>
                                {o.score}
                              </span>
                            ) : (
                              <span className="text-muted text-xs">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            {/* 4) ANOMÁLIE */}
            <section>
              <div className="flex items-center gap-2 mb-5">
                <Flame className="w-5 h-5 text-red-400" aria-hidden="true" />
                <h2 className="text-xl font-bold text-body">Čo vyskočilo z dát</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {analysis.anomalies.map((a, i) => {
                  const Icon = a.icon === "big" ? Trophy : a.icon === "december" ? CalendarClock
                    : a.icon === "concentration" ? Gauge : ShieldAlert;
                  return (
                    <div key={i} className="bg-card border border-line rounded-2xl p-5 flex flex-col shadow-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Icon className="w-4 h-4 text-emerald-400" aria-hidden="true" />
                        <h3 className="font-bold text-body">{a.title}</h3>
                      </div>
                      <p className="text-sm text-muted flex-1">{a.detail}</p>
                      {a.href && (
                        <a
                          href={a.href}
                          target={a.href.startsWith("http") ? "_blank" : undefined}
                          rel="noreferrer"
                          className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-emerald-400 hover:text-emerald-300"
                        >
                          {a.hrefLabel}
                          {a.href.startsWith("http") ? <ExternalLink className="w-3.5 h-3.5" /> : <ArrowUpRight className="w-3.5 h-3.5" />}
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            <p className="text-xs text-muted text-center pt-4">
              Analýzy sú generované automaticky z tabuľky zmlúv (CRZ). Ide o štatistické ukazovatele, nie o právne
              závery. Zdrojové dokumenty otvoríte cez odkazy na crz.gov.sk.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
