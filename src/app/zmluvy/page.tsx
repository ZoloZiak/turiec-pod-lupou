"use client";

import { useState, useMemo, useEffect } from "react";
import { FileText, Search, ExternalLink, Calendar, Filter, Loader2 } from "lucide-react";
import Link from "next/link";
import contractStats from "../../data/city-contract-stats.json";

interface Contract {
  cislo: string; rok: string; typ: string; druh: string;
  strany: string; predmet: string; suma: number; mena: string; podpis: string;
}
interface Stats {
  generatedAt: string; source: string; sourceUrl: string;
  totalContracts: number; excludedGraves: number; anonymizedPersons: number; pricedContracts: number;
  bigThreshold: number; bigCount: number; hugeCount: number;
  byYear: Record<string, number>; topTypes: [string, number][];
}

const stats = contractStats as unknown as Stats;
const PER_PAGE = 40;

const formatEur = (a: number) => new Intl.NumberFormat("sk-SK", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(a);

export default function ZmluvyPage() {
  const [all, setAll] = useState<Contract[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [query, setQuery] = useState("");
  const [year, setYear] = useState("");
  const [type, setType] = useState("");
  const [onlyBig, setOnlyBig] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetch("/data/city-contracts.json")
      .then(r => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then((d: Contract[]) => setAll(d))
      .catch(() => setLoadError(true));
  }, []);

  const years = useMemo(
    () => Object.keys(stats.byYear).filter(y => /^\d{4}$/.test(y) && Number(y) >= 2009 && Number(y) <= 2026).sort().reverse(),
    []
  );

  const filtered = useMemo(() => {
    if (!all) return [];
    const q = query.trim().toLowerCase();
    return all.filter(c => {
      if (year && c.rok !== year) return false;
      if (type && c.typ !== type) return false;
      if (onlyBig && c.suma < stats.bigThreshold) return false;
      if (q && !(`${c.strany} ${c.predmet} ${c.cislo} ${c.typ} ${c.druh}`.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [all, query, year, type, onlyBig]);

  useEffect(() => { setPage(1); }, [query, year, type, onlyBig]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const pageItems = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  return (
    <div className="min-h-screen bg-surface text-body pb-20">
      <header className="bg-card text-body pt-16 pb-24 px-4 sm:px-6 lg:px-8 border-b border-line">
        <div className="max-w-7xl mx-auto">
          <Link href="/" className="text-sm font-medium text-muted hover:text-body mb-4 block">&larr; Dashboard</Link>
          <h1 className="text-4xl font-extrabold flex items-center gap-3">
            <FileText className="w-10 h-10 text-emerald-400" aria-hidden="true" /> Zmluvy mesta
          </h1>
          <p className="text-lg text-muted mt-4 max-w-3xl">
            Prehliadateľná evidencia zmlúv mesta Martin z portálu egov (od 2011). Zmluvy o dielo,
            kúpne, nájomné, dotačné aj dodatky — hľadaj podľa strany, predmetu či čísla.
          </p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-12 space-y-8">
        {/* STAT KARTY */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-card p-6 rounded-2xl border border-line shadow-lg">
            <p className="text-xs font-bold uppercase tracking-widest text-muted mb-2">Zmlúv spolu</p>
            <p className="text-3xl font-black text-body">{stats.totalContracts.toLocaleString("sk-SK")}</p>
          </div>
          <div className="bg-card p-6 rounded-2xl border border-line shadow-lg">
            <p className="text-xs font-bold uppercase tracking-widest text-muted mb-2">S cenou</p>
            <p className="text-3xl font-black text-body">{stats.pricedContracts.toLocaleString("sk-SK")}</p>
          </div>
          <div className="bg-card p-6 rounded-2xl border border-line shadow-lg">
            <p className="text-xs font-bold uppercase tracking-widest text-muted mb-2">Veľké (od {formatEur(stats.bigThreshold)})</p>
            <p className="text-3xl font-black text-body">{stats.bigCount.toLocaleString("sk-SK")}</p>
          </div>
          <div className="bg-card p-6 rounded-2xl border border-line shadow-lg">
            <p className="text-xs font-bold uppercase tracking-widest text-muted mb-2">Rozsah</p>
            <p className="text-3xl font-black text-body">2011–2026</p>
          </div>
        </div>

        {/* FILTRE */}
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Hľadať zmluvnú stranu, predmet, číslo zmluvy…"
              className="w-full bg-card border border-line rounded-xl pl-10 pr-4 py-2.5 text-body placeholder:text-muted focus:outline-none focus:border-emerald-500/50"
            />
          </div>
          <select value={year} onChange={(e) => setYear(e.target.value)}
            className="bg-card border border-line rounded-xl px-4 py-2.5 text-body focus:outline-none focus:border-emerald-500/50">
            <option value="">Všetky roky</option>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <select value={type} onChange={(e) => setType(e.target.value)}
            className="bg-card border border-line rounded-xl px-4 py-2.5 text-body focus:outline-none focus:border-emerald-500/50 max-w-[220px]">
            <option value="">Všetky typy</option>
            {stats.topTypes.map(([t]) => <option key={t} value={t}>{t}</option>)}
          </select>
          <button
            onClick={() => setOnlyBig(v => !v)}
            className={`px-4 py-2.5 rounded-xl border text-sm font-medium transition-colors flex items-center gap-2 justify-center ${
              onlyBig ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400" : "bg-card border-line text-muted hover:text-body"
            }`}
          >
            <Filter className="w-4 h-4" aria-hidden="true" /> Len od {formatEur(stats.bigThreshold)}
          </button>
        </div>

        {/* ZOZNAM */}
        {loadError ? (
          <div className="bg-card rounded-2xl border border-line p-10 text-center text-muted">
            Zmluvy sa nepodarilo načítať. Skús obnoviť stránku.
          </div>
        ) : !all ? (
          <div className="bg-card rounded-2xl border border-line p-10 text-center text-muted flex items-center justify-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" /> Načítavam zmluvy…
          </div>
        ) : (
          <>
            <p className="text-sm text-muted">Nájdených {filtered.length.toLocaleString("sk-SK")} zmlúv{filtered.length !== stats.totalContracts ? ` (z ${stats.totalContracts.toLocaleString("sk-SK")})` : ""}.</p>

            <div className="space-y-3">
              {pageItems.map((c, i) => (
                <div key={`${c.cislo}-${c.rok}-${i}`} className="bg-card rounded-2xl border border-line p-5 shadow-sm">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1.5">
                        <span className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-400 px-2.5 py-0.5 rounded-full text-xs font-bold">
                          {c.typ || "Zmluva"}
                        </span>
                        {c.druh && <span className="text-xs text-muted">{c.druh}</span>}
                        <span className="text-xs font-mono text-muted">č. {c.cislo}/{c.rok}</span>
                        {c.podpis && <span className="text-xs text-muted flex items-center gap-1"><Calendar className="w-3 h-3" aria-hidden="true" />{c.podpis}</span>}
                      </div>
                      <p className="font-bold text-body mb-1 truncate">{c.strany}</p>
                      <p className="text-sm text-muted line-clamp-2">{c.predmet}</p>
                    </div>
                    <div className="text-right shrink-0">
                      {c.suma > 0
                        ? <p className="text-2xl font-black text-body">{formatEur(c.suma)}</p>
                        : <p className="text-sm text-muted italic">bez uvedenej ceny</p>}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* STRÁNKOVANIE */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-4">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="px-4 py-2 rounded-lg border border-line bg-card text-body disabled:opacity-40 hover:border-emerald-500/40">
                  ← Predošlá
                </button>
                <span className="text-sm text-muted px-3">Strana {page} / {totalPages}</span>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="px-4 py-2 rounded-lg border border-line bg-card text-body disabled:opacity-40 hover:border-emerald-500/40">
                  Ďalšia →
                </button>
              </div>
            )}
          </>
        )}

        {/* METODIKA */}
        <div className="bg-card/50 rounded-2xl border border-line p-6 text-sm text-muted space-y-2">
          <h3 className="font-bold text-body flex items-center gap-2"><ExternalLink className="w-4 h-4" aria-hidden="true" /> Metodika a zdroj</h3>
          <p>
            Dáta pochádzajú z <a href={stats.sourceUrl} target="_blank" rel="noreferrer" className="text-emerald-400 hover:underline">open-data exportu portálu egov.martin.sk</a> (sekcia 778 — zmluvy mesta).
          </p>
          <p>
            Zo zoznamu <strong className="text-body">vynechávame nájmy hrobových miest</strong> ({stats.excludedGraves.toLocaleString("sk-SK")} zmlúv) — obsahujú mená občanov (osobné údaje) a nie sú výdavkom mesta.
            Pri ostatných zmluvách s fyzickými osobami (nájmy, výpožičky) <strong className="text-body">anonymizujeme meno občana</strong> na „Fyzická osoba" ({stats.anonymizedPersons.toLocaleString("sk-SK")} zmlúv) — suma, predmet a typ zostávajú viditeľné, takže kontrola hospodárenia je zachovaná, ale súkromie občanov chránené. Firmy, živnostníkov a inštitúcie zobrazujeme s názvom.
            Uvedená suma je cena za konkrétnu zmluvu; celkový súčet neuvádzame, lebo dodatky opakovane vykazujú celkovú cenu diela (nie rozdiel), takže by súčet výdavky nafúkol.
            Zmluvy portál nezverejňuje s IČO dodávateľa.
          </p>
        </div>
      </main>
    </div>
  );
}
