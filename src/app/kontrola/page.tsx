"use client";

import { useEffect, useState, useMemo, Suspense } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { ShieldAlert, AlertTriangle, FileWarning, ShoppingCart, Building2, ExternalLink, Loader2, Search, Link2, Check } from "lucide-react";
import orderStats from "../../data/order-stats.json";
import SiteNav from "../components/SiteNav";

type Entity = { name: string; ico: string };
type Tx = {
  id: string;
  source_type: "CRZ_CONTRACT" | "WEB_INVOICE";
  amount_eur: number;
  subject: string;
  date_published: string;
  source_url?: string;
  supplier?: Entity;
  is_income?: boolean;
  suspicious?: boolean;
  superseded?: boolean;
  rpvs_status?: string | null;
};
type ApiData = { success: boolean; transactions: Tx[] };

interface BigOrder {
  cislo: string; supplier: string; ico: string | null; amount_eur: number;
  date: string; text: string; hasContract: boolean; suspicious: boolean;
}
const ORDER_FLAGS = (orderStats as unknown as { bigOrders: BigOrder[] }).bigOrders.filter(o => o.suspicious);

const formatEur = (v: number) =>
  new Intl.NumberFormat("sk-SK", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);
const crzUrl = (u?: string) => (u ? (u.startsWith("http") ? u : `https://${u}`) : null);

type Tab = "vsetko" | "faktury" | "objednavky" | "rpvs";

export default function KontrolaPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-surface" />}>
      <KontrolaContent />
    </Suspense>
  );
}

function KontrolaContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const initTab = (["vsetko", "faktury", "objednavky", "rpvs"].includes(searchParams.get("tab") || "")
    ? searchParams.get("tab") : "vsetko") as Tab;

  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>(initTab);
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [copied, setCopied] = useState(false);

  // Drž URL v zhode so stavom (zdieľateľný odkaz na presný filter)
  useEffect(() => {
    const p = new URLSearchParams();
    if (tab !== "vsetko") p.set("tab", tab);
    if (query.trim()) p.set("q", query.trim());
    const qs = p.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [tab, query, pathname, router]);

  function copyShareLink() {
    if (typeof window === "undefined") return;
    navigator.clipboard?.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  }

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

  // Faktúry ≥10k bez zmluvy (audit flag z /api/data)
  const invoiceFlags = useMemo(
    () => (data?.transactions ?? []).filter(t => t.suspicious && t.source_type === "WEB_INVOICE" && !t.superseded),
    [data]
  );
  // RPVS not_registered pri zákazke nad 100k
  const rpvsFlags = useMemo(
    () => (data?.transactions ?? []).filter(t => t.rpvs_status === "not_registered" && !t.is_income && !t.superseded && (Number(t.amount_eur) || 0) >= 100000),
    [data]
  );

  const invoiceSum = useMemo(() => invoiceFlags.reduce((s, t) => s + (Number(t.amount_eur) || 0), 0), [invoiceFlags]);
  const orderSum = useMemo(() => ORDER_FLAGS.reduce((s, o) => s + o.amount_eur, 0), []);

  const q = query.trim().toLowerCase();
  const showInvoices = (tab === "vsetko" || tab === "faktury")
    && invoiceFlags.filter(t => !q || `${t.supplier?.name} ${t.subject}`.toLowerCase().includes(q));
  const showOrders = (tab === "vsetko" || tab === "objednavky")
    && ORDER_FLAGS.filter(o => !q || `${o.supplier} ${o.text} ${o.cislo}`.toLowerCase().includes(q));
  const showRpvs = (tab === "vsetko" || tab === "rpvs")
    && rpvsFlags.filter(t => !q || `${t.supplier?.name} ${t.subject}`.toLowerCase().includes(q));

  return (
    <div className="min-h-screen bg-surface text-body pb-20">
      <SiteNav />
      <header className="bg-card text-body pt-16 pb-24 px-4 sm:px-6 lg:px-8 border-b border-line">
        <div className="max-w-7xl mx-auto">
          <Link href="/" className="text-sm font-medium text-muted hover:text-body mb-4 block">&larr; Dashboard</Link>
          <h1 className="text-4xl font-extrabold flex items-center gap-3">
            <ShieldAlert className="w-10 h-10 text-amber-400" aria-hidden="true" /> Kontrola
          </h1>
          <p className="text-lg text-muted mt-4 max-w-3xl">
            Zjednotený prehľad otáznikov naprieč všetkými vrstvami: faktúry aj objednávky nad 10 000 €
            bez zverejnenej zmluvy a dodávatelia mimo Registra partnerov verejného sektora pri veľkých zákazkách.
            Toto <strong className="text-body">nie je zoznam pochybení</strong> — sú to miesta hodné bližšieho pohľadu.
          </p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-12 space-y-8">
        {/* STAT KARTY */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button onClick={() => setTab("faktury")} className={`text-left bg-card p-6 rounded-2xl border shadow-lg transition-colors ${tab === "faktury" ? "border-amber-500/50" : "border-line hover:border-amber-500/30"}`}>
            <p className="text-xs font-bold uppercase tracking-widest text-amber-400 mb-2 flex items-center gap-1.5"><FileWarning className="w-4 h-4" aria-hidden="true" /> Faktúry bez zmluvy</p>
            <p className="text-3xl font-black text-body">{loading ? "…" : invoiceFlags.length}</p>
            <p className="text-sm text-muted mt-1">{loading ? "" : formatEur(invoiceSum)}</p>
          </button>
          <button onClick={() => setTab("objednavky")} className={`text-left bg-card p-6 rounded-2xl border shadow-lg transition-colors ${tab === "objednavky" ? "border-amber-500/50" : "border-line hover:border-amber-500/30"}`}>
            <p className="text-xs font-bold uppercase tracking-widest text-amber-400 mb-2 flex items-center gap-1.5"><ShoppingCart className="w-4 h-4" aria-hidden="true" /> Objednávky bez zmluvy</p>
            <p className="text-3xl font-black text-body">{ORDER_FLAGS.length}</p>
            <p className="text-sm text-muted mt-1">{formatEur(orderSum)}</p>
          </button>
          <button onClick={() => setTab("rpvs")} className={`text-left bg-card p-6 rounded-2xl border shadow-lg transition-colors ${tab === "rpvs" ? "border-amber-500/50" : "border-line hover:border-amber-500/30"}`}>
            <p className="text-xs font-bold uppercase tracking-widest text-amber-400 mb-2 flex items-center gap-1.5"><ShieldAlert className="w-4 h-4" aria-hidden="true" /> Mimo RPVS (nad 100k)</p>
            <p className="text-3xl font-black text-body">{loading ? "…" : rpvsFlags.length}</p>
            <p className="text-sm text-muted mt-1">zákaziek nad 100 000 €</p>
          </button>
        </div>

        {/* FILTER */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex gap-2 flex-wrap">
            {([["vsetko", "Všetko"], ["faktury", "Faktúry"], ["objednavky", "Objednávky"], ["rpvs", "RPVS"]] as [Tab, string][]).map(([k, label]) => (
              <button key={k} onClick={() => setTab(k)}
                className={`px-4 py-2 rounded-xl border text-sm font-medium transition-colors ${tab === k ? "bg-amber-500/15 border-amber-500/30 text-amber-400" : "bg-card border-line text-muted hover:text-body"}`}>
                {label}
              </button>
            ))}
          </div>
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Hľadať dodávateľa, predmet…"
              className="w-full bg-card border border-line rounded-xl pl-10 pr-4 py-2.5 text-body placeholder:text-muted focus:outline-none focus:border-amber-500/50" />
          </div>
          <button onClick={copyShareLink}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-line bg-card text-sm font-medium text-muted hover:text-amber-400 hover:border-amber-500/50 transition-colors shrink-0"
            title="Skopíruj odkaz na tento presný filter">
            {copied ? <><Check className="w-4 h-4 text-emerald-400" aria-hidden="true" /> Skopírované</> : <><Link2 className="w-4 h-4" aria-hidden="true" /> Zdieľať filter</>}
          </button>
        </div>

        {loading ? (
          <div className="bg-card rounded-2xl border border-line p-10 text-center text-muted flex items-center justify-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" /> Načítavam audit…
          </div>
        ) : (
          <div className="space-y-8">
            {/* FAKTÚRY */}
            {showInvoices && showInvoices.length > 0 && (
              <section>
                <h2 className="text-lg font-bold text-body mb-3 flex items-center gap-2"><FileWarning className="w-5 h-5 text-amber-400" aria-hidden="true" /> Faktúry ≥10 000 € bez zmluvy ({showInvoices.length})</h2>
                <div className="space-y-3">
                  {showInvoices.map(t => (
                    <div key={t.id} className="bg-card rounded-2xl border border-line p-5 shadow-sm">
                      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1.5">
                            <span className="inline-flex items-center gap-1 bg-amber-500/15 text-amber-400 px-2.5 py-0.5 rounded-full text-xs font-bold"><AlertTriangle className="w-3 h-3" aria-hidden="true" /> Faktúra bez zmluvy</span>
                            <span className="text-xs text-muted">{new Date(t.date_published).toLocaleDateString("sk-SK")}</span>
                          </div>
                          <div className="flex items-center gap-2 mb-1">
                            <Building2 className="w-4 h-4 text-muted shrink-0" aria-hidden="true" />
                            {t.supplier?.ico ? (
                              <Link href={`/dodavatel/${t.supplier.ico}`} className="font-bold text-body hover:text-amber-400 truncate">{t.supplier.name}</Link>
                            ) : <span className="font-bold text-body truncate">{t.supplier?.name}</span>}
                          </div>
                          <p className="text-sm text-muted line-clamp-2">{t.subject}</p>
                          {crzUrl(t.source_url) && <a href={crzUrl(t.source_url)!} target="_blank" rel="noreferrer" className="text-xs text-amber-400 hover:underline mt-1 inline-flex items-center gap-1">Otvoriť faktúru <ExternalLink className="w-3 h-3" aria-hidden="true" /></a>}
                        </div>
                        <div className="text-right shrink-0"><p className="text-2xl font-black text-body">{formatEur(Number(t.amount_eur) || 0)}</p></div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* OBJEDNÁVKY */}
            {showOrders && showOrders.length > 0 && (
              <section>
                <h2 className="text-lg font-bold text-body mb-3 flex items-center gap-2"><ShoppingCart className="w-5 h-5 text-amber-400" aria-hidden="true" /> Objednávky ≥10 000 € bez zmluvy ({showOrders.length})</h2>
                <div className="space-y-3">
                  {showOrders.map((o, i) => (
                    <div key={`${o.cislo}-${i}`} className="bg-card rounded-2xl border border-line p-5 shadow-sm">
                      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1.5">
                            <span className="inline-flex items-center gap-1 bg-amber-500/15 text-amber-400 px-2.5 py-0.5 rounded-full text-xs font-bold"><AlertTriangle className="w-3 h-3" aria-hidden="true" /> Objednávka bez zmluvy</span>
                            <span className="text-xs font-mono text-muted">obj. {o.cislo}</span>
                            <span className="text-xs text-muted">{o.date}</span>
                          </div>
                          <div className="flex items-center gap-2 mb-1">
                            <Building2 className="w-4 h-4 text-muted shrink-0" aria-hidden="true" />
                            {o.ico ? (
                              <Link href={`/dodavatel/${o.ico}`} className="font-bold text-body hover:text-amber-400 truncate">{o.supplier}</Link>
                            ) : <span className="font-bold text-body truncate">{o.supplier}</span>}
                          </div>
                          <p className="text-sm text-muted line-clamp-2">{o.text}</p>
                        </div>
                        <div className="text-right shrink-0"><p className="text-2xl font-black text-body">{formatEur(o.amount_eur)}</p></div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* RPVS */}
            {showRpvs && showRpvs.length > 0 && (
              <section>
                <h2 className="text-lg font-bold text-body mb-3 flex items-center gap-2"><ShieldAlert className="w-5 h-5 text-amber-400" aria-hidden="true" /> Dodávatelia mimo RPVS pri zákazke nad 100 000 € ({showRpvs.length})</h2>
                <div className="space-y-3">
                  {showRpvs.map(t => (
                    <div key={t.id} className="bg-card rounded-2xl border border-line p-5 shadow-sm">
                      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1.5">
                            <span className="inline-flex items-center gap-1 bg-amber-500/15 text-amber-400 px-2.5 py-0.5 rounded-full text-xs font-bold"><ShieldAlert className="w-3 h-3" aria-hidden="true" /> Mimo RPVS</span>
                            <span className="text-xs text-muted">{new Date(t.date_published).toLocaleDateString("sk-SK")}</span>
                          </div>
                          <div className="flex items-center gap-2 mb-1">
                            <Building2 className="w-4 h-4 text-muted shrink-0" aria-hidden="true" />
                            {t.supplier?.ico ? (
                              <Link href={`/dodavatel/${t.supplier.ico}`} className="font-bold text-body hover:text-amber-400 truncate">{t.supplier.name}</Link>
                            ) : <span className="font-bold text-body truncate">{t.supplier?.name}</span>}
                          </div>
                          <p className="text-sm text-muted line-clamp-2">{t.subject}</p>
                        </div>
                        <div className="text-right shrink-0"><p className="text-2xl font-black text-body">{formatEur(Number(t.amount_eur) || 0)}</p></div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* prázdny stav */}
            {(!showInvoices || showInvoices.length === 0) && (!showOrders || showOrders.length === 0) && (!showRpvs || showRpvs.length === 0) && (
              <div className="bg-card rounded-2xl border border-line p-10 text-center text-muted">
                Pre zvolený filter niet otáznikov.
              </div>
            )}
          </div>
        )}

        {/* METODIKA */}
        <div className="bg-card/50 rounded-2xl border border-line p-6 text-sm text-muted space-y-2">
          <h3 className="font-bold text-body flex items-center gap-2"><ExternalLink className="w-4 h-4" aria-hidden="true" /> Ako čítať tento prehľad</h3>
          <p>
            Každý riadok je <strong className="text-body">ukazovateľ na ďalšie skúmanie, nie dôkaz pochybenia</strong>.
            „Bez zmluvy&quot; znamená, že k platbe/objednávke nad 10 000 € sme nenašli zverejnenú zmluvu v národnom
            registri CRZ ani v zmluvách mesta — môže ísť o legitímnu dodávku, ktorej zmluva nie je (ešte) online.
          </p>
          <p>
            Štátne inštitúcie (daňový úrad, poisťovne), interné mestské podniky a monopolných správcov sietí
            (energie, voda, telco) z auditu <strong className="text-body">vylučujeme</strong> — ich vzťah s mestom je zákonný/rámcový, nie otáznik.
            Dodávateľov bez prideleného IČO neoznačujeme, aby nevzniklo falošné obvinenie. „Mimo RPVS&quot; sa
            vzťahuje len na zákazky nad zákonný prah 100 000 € a rozlišuje výpadok registra od skutočného nezápisu.
          </p>
        </div>
      </main>
    </div>
  );
}
