"use client";

import SiteNav from "../components/SiteNav";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { Building2, Search, Trophy, Users, Coins, ArrowUpDown } from "lucide-react";
import { isValidIco } from "@/lib/entity-ico-fixes";

// ── Typy (zhoda s /api/data) ─────────────────────────────────────────────
type Entity = { name: string; ico: string };
type Tx = {
  id: string;
  source_type: "CRZ_CONTRACT" | "WEB_INVOICE";
  amount_eur: number;
  subject: string;
  date_published: string;
  supplier?: Entity;
  buyer?: Entity;
  is_income?: boolean;
  superseded?: boolean;
};
type ApiData = { success: boolean; transactions: Tx[] };

const formatEur = (v: number) =>
  new Intl.NumberFormat("sk-SK", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);

const num = (v: unknown) => Number(v) || 0;
// Efektívna (rátaná) suma: superseded dodatky (staršie prepisy tej istej ceny) = 0,
// aby sa tá istá zmluva nezapočítala viackrát (viď src/lib/contract-amendments.ts).
const eff = (t: Tx) => (t.superseded ? 0 : num(t.amount_eur));

type Supplier = { name: string; ico: string; total: number; count: number; firstYear: string; lastYear: string };
type SortKey = "total" | "count" | "name";

export default function DodavateliaPage() {
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("total");

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

  // Zoznam dodávateľov z OVERENÝCH CRZ zmlúv (rovnaký základ ako homepage + /analyzy):
  // výdavky = CRZ zmluvy okrem príjmov; efektívna suma (superseded dodatky rátajú 1×, nie N×).
  // Faktúry (WEB_INVOICE) sa NEspočítavajú — sú samostatná vrstva (dvojité počítanie).
  const suppliers = useMemo<Supplier[]>(() => {
    if (!data) return [];
    const expenses = data.transactions.filter((t) => !t.is_income && t.source_type === "CRZ_CONTRACT");
    const map = new Map<string, Supplier>();
    for (const t of expenses) {
      if (!t.supplier) continue;
      const name = t.supplier.name;
      const e = map.get(name) || { name, ico: "", total: 0, count: 0, firstYear: "", lastYear: "" };
      e.total += eff(t);
      // Počet = len kanonické (nie superseded) zmluvy — inak by dodatky nafúkli počet.
      if (!t.superseded) e.count += 1;
      // Drž IČO pre odkaz na profil: preferuj platné 8-ciferné IČO, inak akékoľvek neprázdne.
      const ico = t.supplier.ico;
      if (ico && (!e.ico || (!isValidIco(e.ico) && isValidIco(ico)))) e.ico = ico;
      const y = t.date_published?.slice(0, 4);
      if (y) {
        if (!e.firstYear || y < e.firstYear) e.firstYear = y;
        if (!e.lastYear || y > e.lastYear) e.lastYear = y;
      }
      map.set(name, e);
    }
    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [data]);

  const totalPaid = useMemo(() => suppliers.reduce((s, x) => s + x.total, 0), [suppliers]);
  const biggest = suppliers[0];

  const filtered = useMemo<Supplier[]>(() => {
    const q = query.trim().toLowerCase();
    let arr = suppliers;
    if (q) arr = arr.filter((s) => s.name.toLowerCase().includes(q) || (s.ico || "").toLowerCase().includes(q));
    const sorted = [...arr];
    if (sortKey === "count") sorted.sort((a, b) => b.count - a.count || b.total - a.total);
    else if (sortKey === "name") sorted.sort((a, b) => a.name.localeCompare(b.name, "sk"));
    else sorted.sort((a, b) => b.total - a.total);
    return sorted;
  }, [suppliers, query, sortKey]);

  const period = (s: Supplier) =>
    s.firstYear ? (s.firstYear === s.lastYear ? s.firstYear : `${s.firstYear}–${s.lastYear}`) : "—";

  return (
    <div className="min-h-screen bg-surface text-body font-sans pb-20">
      <SiteNav />
      {/* HEADER */}
      <header className="bg-card border-b border-line pt-10 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <Link href="/" className="text-sm font-medium text-muted hover:text-body mb-4 block">
            &larr; Dashboard
          </Link>
          <h1 className="text-3xl sm:text-4xl font-extrabold flex items-center gap-3">
            <Building2 className="w-9 h-9 text-emerald-400" aria-hidden="true" /> Dodávatelia mesta
          </h1>
          <p className="text-base sm:text-lg text-muted mt-4 max-w-3xl">
            Úplný prehľadný zoznam všetkých dodávateľov, ktorým mesto a jeho podniky zaplatili na základe
            overených zmlúv (Centrálny register zmlúv). Hľadajte, zoraďte a otvorte profil ktorejkoľvek firmy.
          </p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8 space-y-8">
        {loading || !data ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
          </div>
        ) : suppliers.length === 0 ? (
          <div className="bg-card rounded-2xl border border-line p-10 text-center text-muted">
            Zatiaľ žiadni dodávatelia na zobrazenie.
          </div>
        ) : (
          <>
            {/* SUHRN */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-card border border-line rounded-2xl p-6">
                <p className="text-xs font-bold uppercase tracking-widest text-muted mb-2 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-emerald-400" aria-hidden="true" /> Počet dodávateľov
                </p>
                <div className="text-3xl font-black text-body">{suppliers.length.toLocaleString("sk-SK")}</div>
              </div>
              <div className="bg-card border border-line rounded-2xl p-6">
                <p className="text-xs font-bold uppercase tracking-widest text-muted mb-2 flex items-center gap-1.5">
                  <Coins className="w-4 h-4 text-emerald-400" aria-hidden="true" /> Spolu vyplatené
                </p>
                <div className="text-3xl font-black text-body">{formatEur(totalPaid)}</div>
              </div>
              <div className="bg-card border border-line rounded-2xl p-6">
                <p className="text-xs font-bold uppercase tracking-widest text-muted mb-2 flex items-center gap-1.5">
                  <Trophy className="w-4 h-4 text-emerald-400" aria-hidden="true" /> Najväčší dodávateľ
                </p>
                {biggest ? (
                  <>
                    <div className="text-lg font-black text-body truncate" title={biggest.name}>{biggest.name}</div>
                    <div className="text-sm text-muted mt-0.5">{formatEur(biggest.total)}</div>
                  </>
                ) : (
                  <div className="text-3xl font-black text-body">—</div>
                )}
              </div>
            </div>

            {/* FILTER + ZORADENIE */}
            <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Hľadať dodávateľa alebo IČO…"
                  className="w-full bg-card border border-line rounded-xl pl-10 pr-4 py-2.5 text-body placeholder:text-muted focus:outline-none focus:border-emerald-500/50"
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                {([["total", "Podľa sumy"], ["count", "Podľa počtu"], ["name", "Podľa názvu"]] as [SortKey, string][]).map(([k, label]) => (
                  <button
                    key={k}
                    onClick={() => setSortKey(k)}
                    className={`px-4 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                      sortKey === k ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400" : "bg-card border-line text-muted hover:text-body"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* TABUĽKA */}
            <section className="bg-card border border-line rounded-2xl p-4 sm:p-6 shadow-lg">
              <p className="text-sm text-muted mb-4">
                Zobrazených <strong className="text-body">{filtered.length.toLocaleString("sk-SK")}</strong> dodávateľov
                {query.trim() && <> pre „{query.trim()}“</>}.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-muted uppercase border-b border-line">
                    <tr>
                      <th className="px-3 py-3 font-medium">
                        <button onClick={() => setSortKey("name")} className={`inline-flex items-center gap-1 ${sortKey === "name" ? "text-emerald-400" : "hover:text-body"}`}>
                          Dodávateľ <ArrowUpDown className="w-3 h-3" aria-hidden="true" />
                        </button>
                      </th>
                      <th className="px-3 py-3 font-medium text-right">
                        <button onClick={() => setSortKey("count")} className={`inline-flex items-center gap-1 ${sortKey === "count" ? "text-emerald-400" : "hover:text-body"}`}>
                          Počet zmlúv <ArrowUpDown className="w-3 h-3" aria-hidden="true" />
                        </button>
                      </th>
                      <th className="px-3 py-3 font-medium text-right whitespace-nowrap">Obdobie</th>
                      <th className="px-3 py-3 font-medium text-right">
                        <button onClick={() => setSortKey("total")} className={`inline-flex items-center gap-1 ${sortKey === "total" ? "text-emerald-400" : "hover:text-body"}`}>
                          Celkom (€) <ArrowUpDown className="w-3 h-3" aria-hidden="true" />
                        </button>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {filtered.map((s) => {
                      const linkable = isValidIco(s.ico) && !s.ico.startsWith("NO_ICO_");
                      return (
                        <tr key={s.name} className="hover:bg-elevated transition-colors">
                          <td className="px-3 py-3">
                            {linkable ? (
                              <Link href={`/dodavatel/${s.ico}`} className="font-semibold text-body hover:text-emerald-400">
                                {s.name}
                              </Link>
                            ) : (
                              <span className="font-semibold text-body">{s.name}</span>
                            )}
                            {linkable && <div className="text-xs text-muted mt-0.5 font-mono">IČO {s.ico}</div>}
                          </td>
                          <td className="px-3 py-3 text-right font-mono text-muted">{s.count.toLocaleString("sk-SK")}</td>
                          <td className="px-3 py-3 text-right font-mono text-muted whitespace-nowrap">{period(s)}</td>
                          <td className="px-3 py-3 text-right font-mono text-body font-semibold">{formatEur(s.total)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {filtered.length === 0 && (
                  <div className="text-center text-muted py-10">Pre „{query.trim()}“ sa nenašiel žiadny dodávateľ.</div>
                )}
              </div>
            </section>

            {/* METODIKA */}
            <div className="bg-elevated/60 rounded-2xl border border-line p-6 text-sm text-muted space-y-2">
              <h3 className="font-bold text-body flex items-center gap-2">
                <Building2 className="w-4 h-4 text-emerald-400" aria-hidden="true" /> Ako čítať tento zoznam
              </h3>
              <p>
                Poradie vychádza z <strong className="text-body">overených zmlúv v Centrálnom registri zmlúv (CRZ)</strong>.
                Rátame efektívne sumy: kumulatívne dodatky k tej istej zmluve sa počítajú <strong className="text-body">raz</strong>,
                nie viackrát — rovnako ako na úvodnej stránke a v Analýzach.
              </p>
              <p>
                Faktúry sú <strong className="text-body">samostatná vrstva</strong> a do tohto súčtu sa nespočítavajú
                (platba faktúry je často v rámci zmluvy, ktorá už je započítaná — sčítať obe by znamenalo dvojité počítanie).
              </p>
              <p>
                Toto je <strong className="text-body">verejný záznam platieb, nie obvinenie z pochybenia</strong>. Vysoká suma
                znamená len to, že firma pre mesto veľa pracovala. Meno dodávateľa odkazuje na jeho profil len vtedy, keď
                má platné IČO.
              </p>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
