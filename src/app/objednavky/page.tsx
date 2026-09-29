"use client";

import { useState, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { ShoppingCart, AlertTriangle, ExternalLink, Search, CheckCircle, Building } from "lucide-react";
import Link from "next/link";
import orderStats from "../../data/order-stats.json";
import ExportButtons from "../components/ExportButtons";

interface BigOrder {
  cislo: string; supplier: string; ico: string | null; amount_eur: number;
  date: string; text: string; hasContract: boolean; suspicious: boolean;
}
interface OrderStats {
  generatedAt: string; source: string; sourceUrl: string;
  totalOrdered: number; orderCount: number; bigThreshold: number;
  bigOrderCount: number; bigOrdersMatchedIco: number;
  byYear: Record<string, { count: number; sum: number }>;
  bigOrders: BigOrder[];
}

const stats = orderStats as unknown as OrderStats;

const formatEur = (a: number) => new Intl.NumberFormat("sk-SK", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(a);

export default function ObjednavkyPage() {
  const [query, setQuery] = useState("");
  const [onlyRedFlag, setOnlyRedFlag] = useState(false);

  const yearData = useMemo(
    () => Object.entries(stats.byYear)
      .filter(([y]) => /^\d{4}$/.test(y) && Number(y) >= 2011)
      .map(([year, v]) => ({ year, sum: Math.round(v.sum), count: v.count })),
    []
  );

  const redFlagCount = useMemo(() => stats.bigOrders.filter(o => o.suspicious).length, []);
  const redFlagSum = useMemo(() => stats.bigOrders.filter(o => o.suspicious).reduce((s, o) => s + o.amount_eur, 0), []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return stats.bigOrders.filter(o => {
      if (onlyRedFlag && !o.suspicious) return false;
      if (q && !(`${o.supplier} ${o.text} ${o.cislo}`.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [query, onlyRedFlag]);

  return (
    <div className="min-h-screen bg-surface text-body pb-20">
      <header className="bg-card text-body pt-16 pb-24 px-4 sm:px-6 lg:px-8 border-b border-line">
        <div className="max-w-7xl mx-auto">
          <Link href="/" className="text-sm font-medium text-muted hover:text-body mb-4 block">&larr; Dashboard</Link>
          <h1 className="text-4xl font-extrabold flex items-center gap-3">
            <ShoppingCart className="w-10 h-10 text-emerald-400" aria-hidden="true" /> Objednávky mesta
          </h1>
          <p className="text-lg text-muted mt-4 max-w-3xl">
            Kompletná história objednávok mesta Martin z portálu egov (sekcia 781), roky 2011–2026.
            Objednávka je predchodca faktúry — mesto ňou zadáva dodávku. Veľké objednávky (od {formatEur(stats.bigThreshold)})
            bez zmluvy sledujeme rovnako ako faktúry bez zmluvy.
          </p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-12 space-y-8">
        {/* STAT KARTY */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-card p-6 rounded-2xl border border-line shadow-lg">
            <p className="text-xs font-bold uppercase tracking-widest text-muted mb-2">Objednávky spolu</p>
            <p className="text-3xl font-black text-body">{formatEur(stats.totalOrdered)}</p>
            <p className="text-sm text-muted mt-1">{stats.orderCount.toLocaleString("sk-SK")} objednávok</p>
          </div>
          <div className="bg-card p-6 rounded-2xl border border-line shadow-lg">
            <p className="text-xs font-bold uppercase tracking-widest text-muted mb-2">Veľké (od {formatEur(stats.bigThreshold)})</p>
            <p className="text-3xl font-black text-body">{stats.bigOrderCount}</p>
            <p className="text-sm text-muted mt-1">{stats.bigOrdersMatchedIco} s prideleným IČO</p>
          </div>
          <div className="bg-card p-6 rounded-2xl border border-line shadow-lg">
            <p className="text-xs font-bold uppercase tracking-widest text-amber-400 mb-2">Bez zmluvy (otáznik)</p>
            <p className="text-3xl font-black text-amber-400">{redFlagCount}</p>
            <p className="text-sm text-muted mt-1">{formatEur(redFlagSum)}</p>
          </div>
          <div className="bg-card p-6 rounded-2xl border border-line shadow-lg">
            <p className="text-xs font-bold uppercase tracking-widest text-muted mb-2">Rozsah</p>
            <p className="text-3xl font-black text-body">2011–2026</p>
            <p className="text-sm text-muted mt-1">egov.martin.sk (781)</p>
          </div>
        </div>

        {/* TREND PO ROKOCH */}
        <div className="bg-card p-6 rounded-2xl border border-line shadow-lg">
          <h2 className="text-lg font-bold text-body mb-4">Objednávky po rokoch</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={yearData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
              <XAxis dataKey="year" stroke="var(--line)" tick={{ fill: "var(--muted)", fontSize: 12 }} />
              <YAxis stroke="var(--line)" tick={{ fill: "var(--muted)", fontSize: 12 }} tickFormatter={(v) => `${(v / 1e6).toFixed(1)}M`} />
              <Tooltip
                contentStyle={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 12, color: "var(--body)" }}
                formatter={(val) => [formatEur(Number(val)), "Suma"]}
                labelStyle={{ color: "var(--muted)" }}
              />
              <Bar dataKey="sum" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* FILTER + ZOZNAM */}
        <div>
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Hľadať dodávateľa, predmet, číslo objednávky…"
                className="w-full bg-card border border-line rounded-xl pl-10 pr-4 py-2.5 text-body placeholder:text-muted focus:outline-none focus:border-emerald-500/50"
              />
            </div>
            <button
              onClick={() => setOnlyRedFlag(v => !v)}
              className={`px-4 py-2.5 rounded-xl border text-sm font-medium transition-colors flex items-center gap-2 justify-center ${
                onlyRedFlag ? "bg-amber-500/15 border-amber-500/30 text-amber-400" : "bg-card border-line text-muted hover:text-body"
              }`}
            >
              <AlertTriangle className="w-4 h-4" aria-hidden="true" /> Len bez zmluvy ({redFlagCount})
            </button>
          </div>

          <p className="text-sm text-muted mb-3">Zobrazených {filtered.length} z {stats.bigOrderCount} veľkých objednávok.</p>

          <div className="mb-4">
            <ExportButtons
              rows={filtered.map(o => ({
                cislo_objednavky: o.cislo,
                datum: o.date,
                dodavatel: o.supplier,
                ico: o.ico ?? "",
                predmet: o.text,
                suma_eur: o.amount_eur,
                ma_zmluvu: o.hasContract ? "áno" : "nie",
                bez_zmluvy_otaznik: o.suspicious ? "áno" : "nie",
              }))}
              basename="objednavky-mesta-martin"
              countLabel={`${filtered.length.toLocaleString("sk-SK")} zobrazených objednávok`}
            />
          </div>

          <div className="space-y-3">
            {filtered.map((o, i) => (
              <div key={`${o.cislo}-${i}`} className="bg-card rounded-2xl border border-line p-5 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      {o.suspicious ? (
                        <span className="inline-flex items-center gap-1 bg-amber-500/15 text-amber-400 px-2.5 py-0.5 rounded-full text-xs font-bold">
                          <AlertTriangle className="w-3 h-3" aria-hidden="true" /> Bez zmluvy
                        </span>
                      ) : o.hasContract ? (
                        <span className="inline-flex items-center gap-1 bg-emerald-500/15 text-emerald-400 px-2.5 py-0.5 rounded-full text-xs font-bold">
                          <CheckCircle className="w-3 h-3" aria-hidden="true" /> Má zmluvu
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-elevated text-muted px-2.5 py-0.5 rounded-full text-xs font-bold">
                          Nezaradené
                        </span>
                      )}
                      <span className="text-xs font-mono text-muted">obj. {o.cislo}</span>
                      <span className="text-xs text-muted">{o.date}</span>
                    </div>
                    <div className="flex items-center gap-2 mb-1">
                      <Building className="w-4 h-4 text-muted shrink-0" aria-hidden="true" />
                      {o.ico ? (
                        <Link href={`/dodavatel/${o.ico}`} className="font-bold text-body hover:text-emerald-400 truncate">
                          {o.supplier}
                        </Link>
                      ) : (
                        <span className="font-bold text-body truncate">{o.supplier}</span>
                      )}
                    </div>
                    <p className="text-sm text-muted line-clamp-2">{o.text}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-2xl font-black text-body">{formatEur(o.amount_eur)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* METODIKA */}
        <div className="bg-card/50 rounded-2xl border border-line p-6 text-sm text-muted space-y-2">
          <h3 className="font-bold text-body flex items-center gap-2"><ExternalLink className="w-4 h-4" aria-hidden="true" /> Metodika a zdroj</h3>
          <p>
            Dáta pochádzajú z <a href={stats.sourceUrl} target="_blank" rel="noreferrer" className="text-emerald-400 hover:underline">open-data exportu portálu egov.martin.sk</a> (sekcia 781 — objednávky).
            Do zoznamu zobrazujeme významné objednávky od {formatEur(stats.bigThreshold)}; menšie sú v celkovom súčte.
          </p>
          <p>
            „Bez zmluvy" znamená, že dodávateľ tejto veľkej objednávky nemá v evidencii zmluvu s mestom (národný register CRZ ani zmluvy mesta) —
            je to <strong className="text-body">ukazovateľ na ďalšie skúmanie, nie dôkaz pochybenia</strong>. Štátne inštitúcie (daňový úrad, poisťovne),
            interné podniky a monopolných správcov sietí zo zoznamu vylučujeme. Objednávky bez prideleného IČO neoznačujeme, aby nevzniklo falošné obvinenie.
          </p>
        </div>
      </main>
    </div>
  );
}
