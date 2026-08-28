"use client";

import { useEffect, useState, useCallback } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Search, AlertTriangle, ExternalLink, Calendar, CheckCircle, ShieldAlert, Menu, X, Lightbulb, ShieldCheck } from "lucide-react";
import Link from "next/link";
import RpvsBadge from "./components/RpvsBadge";
import InfoIcon from "./components/InfoIcon";
import VerifiedBadge from "./components/VerifiedBadge";
import MacroStats from "./components/MacroStats";
import { isRpvsExempt } from "@/lib/rpvs-exempt";
import NumberFlow from "@number-flow/react";
import SpotlightCard from "./components/SpotlightCard";

type Entity = { name: string; ico: string };
type Supplier = { name: string; ico: string };
type Tx = {
  id: string;
  external_id?: string;
  source_type: 'CRZ_CONTRACT' | 'WEB_INVOICE';
  amount_eur: number;
  subject: string;
  date_published: string;
  source_url?: string;
  buyer?: Entity;
  supplier?: Supplier;
  suspicious?: boolean;
  is_income?: boolean;
};
type SupplierAgg = { name: string; value: number };
type DashboardData = {
  success: boolean;
  stats: { totalSpent: number; totalIncome: number; totalContracts: number; incomeCount: number; entitiesCount: number };
  topSuppliers: SupplierAgg[];
  transactions: Tx[];
  entities: Entity[];
};

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedIco, setSelectedIco] = useState("");
  const [selectedSupplierName, setSelectedSupplierName] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [redFlagFilter, setRedFlagFilter] = useState<'all' | 'high_amount' | 'december' | 'missing_contract'>('all');
  const [sourceTypeFilter, setSourceTypeFilter] = useState<'all' | 'CRZ_CONTRACT' | 'WEB_INVOICE'>('all');
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const ITEMS_PER_PAGE = 20;

  const fetchData = useCallback(async (ico: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/data${ico ? `?ico=${ico}` : ""}`);
      const json = await res.json();
      if (json.success) setData(json);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  const changeIco = useCallback((ico: string) => {
    setSelectedSupplierName(null);
    setSearchTerm("");
    setRedFlagFilter("all");
    setSourceTypeFilter("all");
    setSelectedYear("all");
    setCurrentPage(1);
    setSelectedIco(ico);
  }, []);

  // Načítať dáta pri zmene organizácie (filtre resetuje changeIco).
  // Legitímny data-fetch effekt (fetchData nastavuje loading/data) — zámerný vzor.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData(selectedIco);
  }, [selectedIco, fetchData]);

  // Dynamic list of available years
  const availableYears = Array.from(
    new Set(data?.transactions?.map((t: Tx) => new Date(t.date_published).getFullYear()).filter(Boolean))
  ).sort((a, b) => (b as number) - (a as number));

  // Compute filtered transactions
  const filteredTransactions = data?.transactions?.filter((t: Tx) => {
    if (selectedSupplierName && t.supplier?.name !== selectedSupplierName) return false;
    if (redFlagFilter === 'high_amount' && t.amount_eur < 100000) return false;
    if (redFlagFilter === 'missing_contract' && !t.suspicious) return false;
    if (redFlagFilter === 'december' && new Date(t.date_published).getMonth() !== 11) return false;
    if (sourceTypeFilter !== 'all' && t.source_type !== sourceTypeFilter) return false;
    if (selectedYear !== 'all' && new Date(t.date_published).getFullYear().toString() !== selectedYear) return false;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchSubject = t.subject?.toLowerCase().includes(term);
      const matchSupplier = t.supplier?.name?.toLowerCase().includes(term) || t.supplier?.ico?.includes(term);
      if (!matchSubject && !matchSupplier) return false;
    }
    return true;
  }) || [];

  const totalPages = Math.ceil(filteredTransactions.length / ITEMS_PER_PAGE);
  const paginatedTransactions = filteredTransactions.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const formatEur = (val: number) => {
    return new Intl.NumberFormat("sk-SK", { style: "currency", currency: "EUR" }).format(val);
  };

  const COLORS = ["#f87171", "#fb923c", "#fbbf24", "#34d399", "#38bdf8", "#818cf8", "#a78bfa", "#e879f9"];

  return (
    <div className="min-h-screen bg-surface text-body font-sans selection:bg-emerald-500/30">
      {/* HEADER */}
      <header className="bg-card/80 backdrop-blur-md border-b border-line sticky top-0 z-20 shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Search className="w-6 h-6 text-emerald-400" />
            <h1 className="text-xl font-bold tracking-tight text-body drop-shadow-md">Turiec pod Lupou</h1>
          </div>

          {/* DESKTOP BUTTONS */}
          <div className="hidden md:flex gap-4 items-center">
            <Link href="/slubomer" className="text-sm font-medium bg-amber-500/10 hover:bg-amber-500/20 px-4 py-2 rounded-lg text-amber-400 border border-amber-500/20 transition-all flex items-center gap-2">
              <Lightbulb className="w-4 h-4" aria-hidden="true" />
              Sľubomer
            </Link>
            <Link href="/majetky" className="text-sm font-medium bg-indigo-500/10 hover:bg-indigo-500/20 px-4 py-2 rounded-lg text-indigo-400 border border-indigo-500/20 transition-all flex items-center gap-2">
              <ShieldAlert className="w-4 h-4" aria-hidden="true" />
              Majetky
            </Link>
            <Link href="/upozornenia" className="text-sm font-medium bg-red-500/10 hover:bg-red-500/20 px-4 py-2 rounded-lg text-red-400 border border-red-500/20 transition-all flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" aria-hidden="true" />
              Upozornenia
            </Link>
            <Link href="/admin" className="text-sm font-medium bg-elevated hover:bg-elevated px-4 py-2 rounded-lg text-body border border-line transition-all">
              Administrácia
            </Link>
          </div>

          {/* MOBILE MENU TOGGLE */}
          <div className="flex md:hidden items-center">
             <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-2 text-muted hover:text-body rounded-lg" aria-label={isMenuOpen ? "Zavrieť menu" : "Otvoriť menu"} aria-expanded={isMenuOpen}>
               {isMenuOpen ? <X className="w-6 h-6" aria-hidden="true" /> : <Menu className="w-6 h-6" aria-hidden="true" />}
             </button>
          </div>
        </div>
        
        {/* MOBILE DROPDOWN MENU */}
        {isMenuOpen && (
          <div className="md:hidden border-t border-line bg-card px-4 py-4 space-y-4 shadow-lg absolute w-full left-0 max-h-[calc(100vh-4rem)] overflow-y-auto z-30">
             <div className="flex flex-col gap-2">
               <a href="/slubomer" className="text-sm font-medium bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 px-4 py-2.5 rounded-lg text-amber-400 transition-colors flex items-center justify-center gap-2">
                 <Lightbulb className="w-4 h-4" aria-hidden="true" />
                 Sľubomer
               </a>
               <a href="/majetky" className="text-sm font-medium bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 px-4 py-2.5 rounded-lg text-indigo-400 transition-colors flex items-center justify-center gap-2">
                 <ShieldAlert className="w-4 h-4" aria-hidden="true" />
                 Majetky
               </a>
               <a href="/upozornenia" className="text-sm font-medium bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 px-4 py-2.5 rounded-lg text-red-400 transition-colors flex items-center justify-center gap-2">
                 <AlertTriangle className="w-4 h-4" aria-hidden="true" />
                 Upozornenia
               </a>
               <a href="/admin" className="text-sm font-medium bg-elevated hover:bg-elevated border border-line px-4 py-2.5 rounded-lg text-body transition-colors text-center">
                 Administrácia
               </a>
             </div>
             
             <div className="pt-4 border-t border-line">
               <p className="text-xs font-bold text-muted uppercase mb-3">Vyberte organizáciu</p>
               <div className="flex flex-col gap-2">
                  <button
                    onClick={() => { changeIco(""); setIsMenuOpen(false); }}
                    className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all text-left ${selectedIco === "" ? "bg-emerald-500 text-white" : "bg-elevated text-body hover:bg-elevated"}`}
                  >
                    Všetky organizácie
                  </button>
                  {data?.entities?.map((e: Entity) => (
                    <button
                      key={e.ico}
                      onClick={() => { changeIco(e.ico); setIsMenuOpen(false); }}
                      className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all text-left ${selectedIco === e.ico ? "bg-emerald-500 text-white" : "bg-elevated text-body hover:bg-elevated"}`}
                    >
                      {e.name}
                    </button>
                  ))}
               </div>
             </div>
          </div>
        )}

        {/* DESKTOP ENTITY FILTER BAR */}
        <div className="hidden md:block bg-card/80 backdrop-blur-md border-t md:border-t-0 border-line w-full">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap gap-2">
            <button
              onClick={() => changeIco("")}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${selectedIco === "" ? "bg-blue-600 text-white shadow-md ring-2 ring-blue-600 ring-offset-1" : "bg-elevated text-muted hover:bg-elevated"}`}
            >
              Všetky organizácie
            </button>
            {data?.entities?.map((e: Entity) => (
              <button
                key={e.ico}
                onClick={() => changeIco(e.ico)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${selectedIco === e.ico ? "bg-emerald-500 text-white shadow-md ring-2 ring-emerald-500 ring-offset-1 ring-offset-surface" : "bg-elevated text-muted hover:bg-elevated hover:text-body"}`}
              >
                {e.name}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading || !data ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
          </div>
        ) : (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            
            {/* LICZBA-BOHATER (Hero Stat) */}
            <SpotlightCard className="bg-card border border-line rounded-3xl p-6 sm:p-10 flex flex-col items-center justify-center text-center mb-8 shadow-2xl" glowColor="rgba(16, 185, 129, 0.2)">
              <p className="text-emerald-300 font-bold uppercase tracking-widest text-xs sm:text-sm mb-4">Celkové výdavky mesta a podnikov (zmluvy a faktúry)</p>
              <div className="w-full text-[2rem] leading-tight sm:text-6xl md:text-8xl font-black text-body font-mono tracking-tight sm:tracking-tighter break-words drop-shadow-[0_0_15px_rgba(16,185,129,0.4)]">
                <NumberFlow 
                  value={data.stats.totalSpent} 
                  locales="sk-SK"
                  format={{ style: "currency", currency: "EUR", maximumFractionDigits: 0 }} 
                />
              </div>
              <div className="mt-6 flex items-center gap-3 text-muted text-sm">
                <span className="flex items-center gap-1"><CheckCircle className="w-4 h-4 text-emerald-500" /> Živé dáta</span>
                <span className="flex items-center gap-1"><ShieldCheck className="w-4 h-4 text-emerald-500" /> Overené CRZ</span>
              </div>
            </SpotlightCard>

            {/* SECONDARY STATS CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <SpotlightCard className="bg-card p-8 rounded-2xl shadow-lg border border-line flex flex-col items-start" glowColor="rgba(16, 185, 129, 0.18)">
                <p className="text-xs font-bold uppercase tracking-widest text-muted mb-2">Získané dotácie a granty (príjmy)</p>
                <div className="text-4xl font-black text-emerald-400">
                  {formatEur(data.stats.totalIncome)}
                </div>
                <p className="text-xs text-muted mt-2">{data.stats.incomeCount} zmlúv o NFP/dotácii — peniaze pre mesto, nie výdavky</p>
                <div className="mt-4 w-12 h-1 bg-emerald-500/50 rounded-full"></div>
              </SpotlightCard>
              <SpotlightCard className="bg-card p-8 rounded-2xl shadow-lg border border-line flex flex-col items-start" glowColor="rgba(59, 130, 246, 0.15)">
                <p className="text-xs font-bold uppercase tracking-widest text-muted mb-2">Analyzované zmluvy (CRZ)</p>
                <div className="text-4xl sm:text-5xl font-black text-body">
                  <NumberFlow value={data.stats.totalContracts} locales="sk-SK" />
                </div>
                <div className="mt-4 w-12 h-1 bg-blue-500/50 rounded-full"></div>
              </SpotlightCard>
              <SpotlightCard className="bg-card p-8 rounded-2xl shadow-lg border border-line flex flex-col items-start" glowColor="rgba(168, 85, 247, 0.15)">
                <p className="text-xs font-bold uppercase tracking-widest text-muted mb-2">Sledované subjekty</p>
                <div className="text-4xl sm:text-5xl font-black text-body">
                  <NumberFlow value={data.stats.entitiesCount} locales="sk-SK" />
                </div>
                <div className="mt-4 w-12 h-1 bg-purple-500/50 rounded-full"></div>
              </SpotlightCard>
            </div>
            
            <div className="mt-8">
              <MacroStats />
            </div>

            {/* Z-DYKTY NAVIGAČNÝ HUB */}
            <div className="mt-12 mb-12 border-t border-line pt-8">
              <h2 className="text-sm font-bold uppercase tracking-widest mb-6 text-muted">Verejná kontrola</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Link href="/podniky" className="group h-full block">
                  <SpotlightCard className="bg-card border border-line p-6 rounded-xl flex flex-col justify-center text-center transition-all h-full" glowColor="rgba(16, 185, 129, 0.15)">
                    <span className="font-bold text-lg text-body group-hover:text-emerald-400 transition-colors">Mestské podniky</span>
                  </SpotlightCard>
                </Link>
                <Link href="/nku" className="group h-full block">
                  <SpotlightCard className="bg-card border border-line p-6 rounded-xl flex flex-col justify-center text-center transition-all h-full" glowColor="rgba(239, 68, 68, 0.15)">
                    <span className="font-bold text-lg text-body group-hover:text-red-400 transition-colors">Kontroly NKÚ</span>
                  </SpotlightCard>
                </Link>
                <Link href="/eurofondy" className="group h-full block">
                  <SpotlightCard className="bg-card border border-line p-6 rounded-xl flex flex-col justify-center text-center transition-all h-full" glowColor="rgba(59, 130, 246, 0.15)">
                    <span className="font-bold text-lg text-body group-hover:text-blue-400 transition-colors">Eurofondy</span>
                  </SpotlightCard>
                </Link>
                <Link href="/poslanci" className="group h-full block">
                  <SpotlightCard className="bg-card border border-line p-6 rounded-xl flex flex-col justify-center text-center transition-all h-full" glowColor="rgba(168, 85, 247, 0.15)">
                    <span className="font-bold text-lg text-body group-hover:text-purple-400 transition-colors">Hlasovania MsZ</span>
                  </SpotlightCard>
                </Link>
              </div>
            </div>

            {/* CHARTS */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* BAR CHART */}
              <SpotlightCard className="bg-card p-6 rounded-2xl shadow-lg border border-line">
                <h3 className="text-lg font-semibold mb-6 text-body">Top 10 príjemcov (Dodávatelia)</h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart 
                      data={data.topSuppliers} 
                      layout="vertical" 
                      margin={{ left: 50 }}
                    >
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" width={150} tick={{ fontSize: 12, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
                      <Tooltip
                        formatter={(val) => [formatEur(Number(val)), 'Suma']}
                        allowEscapeViewBox={{ x: false, y: false }}
                        contentStyle={{ borderRadius: '12px', backgroundColor: 'var(--card)', border: '1px solid var(--line)', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.5)' }}
                        itemStyle={{ color: 'var(--body)' }}
                        labelStyle={{ color: 'var(--muted)' }}
                        cursor={{ fill: 'var(--elevated)' }}
                      />
                      <Bar 
                        dataKey="value" 
                        radius={[0, 4, 4, 0]} 
                        className="cursor-pointer"
                        onClick={(entry) => {
                          const name = (entry as { name?: string })?.name;
                          if (name) {
                            setSelectedSupplierName(name === selectedSupplierName ? null : name);
                          }
                        }}
                      >
                        {data.topSuppliers.map((entry: SupplierAgg, index: number) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={COLORS[index % COLORS.length]} 
                            opacity={selectedSupplierName ? (selectedSupplierName === entry.name ? 1 : 0.4) : 1}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </SpotlightCard>

              {/* PIE CHART */}
              <SpotlightCard className="bg-card p-6 rounded-2xl shadow-lg border border-line flex flex-col justify-center items-center">
                 <h3 className="text-lg font-semibold mb-2 self-start text-body">Rozdelenie financií</h3>
                 <div className="h-72 w-full mt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data.topSuppliers.slice(0,5)}
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={5}
                        dataKey="value"
                        className="cursor-pointer"
                        onClick={(entry) => {
                          const name = (entry as { name?: string })?.name;
                          if (name) {
                            setSelectedSupplierName(name === selectedSupplierName ? null : name);
                          }
                        }}
                      >
                        {data.topSuppliers.slice(0,5).map((entry: SupplierAgg, index: number) => (
                          <Cell 
                            key={`pie-${index}`} 
                            fill={COLORS[index % COLORS.length]} 
                            opacity={selectedSupplierName ? (selectedSupplierName === entry.name ? 1 : 0.3) : 1}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(val) => [formatEur(Number(val)), 'Suma']}
                        allowEscapeViewBox={{ x: false, y: false }}
                        contentStyle={{ borderRadius: '12px', backgroundColor: 'var(--card)', border: '1px solid var(--line)', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.5)' }}
                        itemStyle={{ color: 'var(--body)' }}
                        labelStyle={{ color: 'var(--muted)' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                 </div>
                 <p className="text-xs text-muted text-center mt-2">Zobrazených top 5 dodávateľov</p>
              </SpotlightCard>
            </div>

            {/* TRANSACTIONS TABLE */}
            <div className="bg-card rounded-2xl shadow-lg border border-line overflow-hidden">
              <div className="p-6 border-b border-line space-y-4">
                <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                  <h3 className="text-lg font-semibold text-body">Najnovšie zverejnené zmluvy a faktúry</h3>
                  <div className="flex items-center gap-3 w-full md:w-auto">
                    {selectedSupplierName && (
                      <button 
                        onClick={() => {
                          setSelectedSupplierName(null);
                          setCurrentPage(1);
                        }}
                        className="flex items-center gap-1 text-sm bg-blue-500/10 text-blue-400 px-3 py-1.5 rounded-full font-medium border border-blue-500/20 hover:bg-blue-500/20 transition-colors whitespace-nowrap"
                      >
                        Filtrujem: {selectedSupplierName} <span className="ml-1 text-lg leading-none">&times;</span>
                      </button>
                    )}
                    <div className="relative w-full md:w-64">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" aria-hidden="true" />
                      <input 
                        type="text" 
                        aria-label="Hľadať zmluvu alebo firmu"
                        placeholder="Hľadať zmluvu alebo firmu..." 
                        value={searchTerm}
                        onChange={(e) => {
                          setSearchTerm(e.target.value);
                          setCurrentPage(1);
                        }}
                        className="w-full pl-9 pr-4 py-1.5 text-sm bg-elevated border border-line text-body rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-shadow placeholder:text-muted"
                      />
                    </div>
                  </div>
                </div>

                {/* RED FLAGS & SOURCE FILTER BAR (z-dykty.pl inspired) */}
                <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-line/80 text-xs font-semibold">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-muted uppercase tracking-widest text-[11px] mr-1">Rýchly audit:</span>
                    <button
                      onClick={() => { setRedFlagFilter('all'); setCurrentPage(1); }}
                      className={`px-3 py-1 rounded-lg border transition-all ${redFlagFilter === 'all' ? 'bg-elevated text-body border-line' : 'bg-elevated/50 text-muted border-line hover:text-body'}`}
                    >
                      Všetky zmluvy
                    </button>
                    <button
                      onClick={() => { setRedFlagFilter('high_amount'); setCurrentPage(1); }}
                      className={`px-3 py-1 rounded-lg border transition-all flex items-center gap-1.5 ${redFlagFilter === 'high_amount' ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : 'bg-elevated/50 text-muted border-line hover:text-amber-400'}`}
                    >
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
                      Zmluvy nad 100 000 €
                    </button>
                    <button
                      onClick={() => { setRedFlagFilter('missing_contract'); setCurrentPage(1); }}
                      className={`px-3 py-1 rounded-lg border transition-all flex items-center gap-1.5 ${redFlagFilter === 'missing_contract' ? 'bg-red-500/20 text-red-300 border-red-500/40' : 'bg-elevated/50 text-muted border-line hover:text-red-400'}`}
                    >
                      <ShieldAlert className="w-3.5 h-3.5 text-red-400" aria-hidden="true" />
                      Chýba zmluva v CRZ
                    </button>
                    <button
                      onClick={() => { setRedFlagFilter('december'); setCurrentPage(1); }}
                      className={`px-3 py-1 rounded-lg border transition-all flex items-center gap-1.5 ${redFlagFilter === 'december' ? 'bg-purple-500/20 text-purple-300 border-purple-500/40' : 'bg-elevated/50 text-muted border-line hover:text-purple-400'}`}
                    >
                      <Calendar className="w-3.5 h-3.5 text-purple-400" aria-hidden="true" />
                      Koncoročný zhonec (December)
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5 border-l border-line pl-3 flex-wrap">
                    <span className="text-muted uppercase tracking-widest text-[11px] mr-1">Zdroj:</span>
                    <button
                      onClick={() => { setSourceTypeFilter('all'); setCurrentPage(1); }}
                      className={`px-2.5 py-1 rounded-md border transition-all ${sourceTypeFilter === 'all' ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-elevated text-muted border-line hover:text-white'}`}
                    >
                      Všetky
                    </button>
                    <button
                      onClick={() => { setSourceTypeFilter('CRZ_CONTRACT'); setCurrentPage(1); }}
                      className={`px-2.5 py-1 rounded-md border transition-all ${sourceTypeFilter === 'CRZ_CONTRACT' ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-elevated text-muted border-line hover:text-white'}`}
                    >
                      CRZ Zmluvy
                    </button>
                    <button
                      onClick={() => { setSourceTypeFilter('WEB_INVOICE'); setCurrentPage(1); }}
                      className={`px-2.5 py-1 rounded-md border transition-all ${sourceTypeFilter === 'WEB_INVOICE' ? 'bg-amber-600 text-white border-amber-500' : 'bg-elevated text-muted border-line hover:text-white'}`}
                    >
                      Faktúry z webu
                    </button>

                    <span className="text-muted uppercase tracking-widest text-[11px] ml-2 mr-1">Rok:</span>
                    <select
                      value={selectedYear}
                      aria-label="Filtrovať podľa roku"
                      onChange={(e) => { setSelectedYear(e.target.value); setCurrentPage(1); }}
                      className="bg-elevated border border-line text-body rounded-md px-2 py-1 text-xs focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                    >
                      <option value="all">Všetky roky</option>
                      {availableYears.map((y: number) => (
                        <option key={y} value={y.toString()}>{y}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              <div className="w-full">
                {/* DESKTOP TABLE VIEW */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm text-left">
                  <thead className="text-xs text-muted uppercase bg-surface/50 border-b border-line">
                    <tr>
                      <th className="px-6 py-4 font-medium">Predmet zákazky</th>
                      <th className="px-6 py-4 font-medium">Dodávateľ</th>
                      <th className="px-6 py-4 font-medium text-right">Suma</th>
                      <th className="px-6 py-4 font-medium">Zdroj a Dátum</th>
                    </tr>
                  </thead>
                   <tbody className="divide-y divide-line">
                    {paginatedTransactions.length > 0 ? (
                      paginatedTransactions.map((t: Tx) => (
                        <tr key={t.id} className="hover:bg-elevated/50 transition-colors">
                          <td className="px-6 py-4">
                            <p className="font-medium text-body line-clamp-2" title={t.subject}>{t.subject}</p>
                            <p className="text-xs text-muted mt-1">Odberateľ: {t.buyer?.name}</p>
                          </td>
                          <td className="px-6 py-4 text-muted font-medium">
                            <Link href={`/dodavatel/${t.supplier?.ico}`} className="text-emerald-400 hover:text-emerald-300 hover:underline font-bold text-base">
                              {t.supplier?.name || "Neznámy"}
                            </Link>
                            <div className="text-xs text-muted font-normal mt-1 flex items-center gap-2">
                              <span>IČO: {t.supplier?.ico}</span>
                              {t.supplier?.ico && !t.supplier.ico.startsWith('NO_ICO_') && (
                                <div className="flex gap-2 ml-2 border-l pl-2 border-line">
                                  <a href={`https://orsr.sk/hladaj_ico.asp?ICO=${t.supplier.ico}&SID=0`} target="_blank" rel="noreferrer" className="text-muted hover:text-emerald-400 hover:underline">ORSR</a>
                                  {!isRpvsExempt(t.supplier.ico, t.supplier?.name) && (
                                    <a href={`/api/rpvs-redirect/${t.supplier.ico}`} target="_blank" rel="noreferrer" className="text-muted hover:text-emerald-400 hover:underline font-semibold text-emerald-400">RPVS</a>
                                  )}
                                  <a href={`https://finstat.sk/${t.supplier.ico}`} target="_blank" rel="noreferrer" className="text-muted hover:text-emerald-400 hover:underline">FinStat</a>
                                </div>
                              )}
                            </div>
                            <div className="flex flex-col gap-1 mt-2 items-start">
                              {t.suspicious && (
                                <div className="inline-flex items-center gap-1 px-2 py-1 bg-red-50 text-red-700 text-xs font-semibold rounded border border-red-100" title="Krížová kontrola: Dodávateľ nemá v databáze žiadnu zmluvu z CRZ, no napriek tomu fakturuje.">
                                  <AlertTriangle className="w-3 h-3" />
                                  Chýba zmluva v CRZ!
                                </div>
                              )}
                              {t.amount_eur >= 100000 && t.supplier?.ico && !t.supplier.ico.startsWith('NO_ICO_') && (
                                <RpvsBadge ico={t.supplier.ico} name={t.supplier?.name} />
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-2">
                            {t.is_income && (
                              <span className="text-[10px] font-bold uppercase tracking-wide bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded" title="Nenávratný finančný príspevok / dotácia — príjem mesta, nie výdavok">
                                Príjem
                              </span>
                            )}
                            <span className={`font-bold px-2 py-1 rounded border ${t.is_income ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' : 'text-body bg-elevated border-line'}`}>
                              {t.is_income ? '+' : ''}{formatEur(t.amount_eur)}
                            </span>
                            <VerifiedBadge source={t.source_type === 'CRZ_CONTRACT' ? 'CRZ (Data.gov.sk)' : 'Mesto Martin (Faktúry)'} date={new Date(t.date_published).toLocaleDateString('sk-SK')} />
                          </div>
                        </td>
                          <td className="px-6 py-4">
                            {t.source_url ? (
                              <a 
                                href={t.source_url?.startsWith('http') ? t.source_url : `https://${t.source_url}`} 
                                target="_blank" 
                                rel="noreferrer"
                                className="group inline-flex flex-col items-start gap-1 p-2 rounded-lg bg-elevated/80 hover:bg-elevated border border-line/80 hover:border-emerald-500/50 transition-all"
                                title="Otvoriť dokument zmluvy / faktúry"
                              >
                                {t.source_type === 'WEB_INVOICE' ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-amber-500/10 border border-amber-500/20 text-amber-400 group-hover:bg-amber-500/20">
                                    Faktúra z webu <ExternalLink className="w-3 h-3 text-amber-400" />
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 group-hover:bg-emerald-500/20">
                                    CRZ Zmluva <ExternalLink className="w-3 h-3 text-emerald-400" />
                                  </span>
                                )}
                                <span className="text-xs text-muted font-mono mt-0.5 group-hover:text-body transition-colors">
                                  {new Date(t.date_published).toLocaleDateString('sk-SK')}
                                </span>
                              </a>
                            ) : (
                              <div className="flex flex-col gap-1">
                                {t.source_type === 'WEB_INVOICE' ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-500/10 border border-amber-500/20 text-amber-400">
                                    Faktúra z webu
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                                    CRZ Zmluva
                                  </span>
                                )}
                                <span className="text-xs text-muted font-mono">
                                  {new Date(t.date_published).toLocaleDateString('sk-SK')}
                                </span>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="px-6 py-12 text-center text-muted">
                          Pre zadané kritériá sa nenašli žiadne záznamy.
                        </td>
                      </tr>
                    )}
                    </tbody>
                  </table>
                </div>

                {/* MOBILE CARD VIEW */}
                <div className="md:hidden flex flex-col gap-4 p-4 border-t border-line bg-surface">
                  {paginatedTransactions.length > 0 ? (
                    paginatedTransactions.map((t: Tx) => (
                      <div key={t.id} className="bg-card p-4 rounded-xl shadow-sm border border-line">
                        <div className="flex justify-between items-start mb-2">
                          <Link href={`/dodavatel/${t.supplier?.ico}`} className="text-emerald-400 hover:text-emerald-300 hover:underline font-bold text-base break-words pr-2">
                            {t.supplier?.name || "Neznámy"}
                          </Link>
                        </div>
                        <p className="text-sm font-medium text-body mb-2">{t.subject}</p>
                        <div className="flex flex-col gap-2 text-xs text-muted">
                          <p>Odberateľ: {t.buyer?.name}</p>
                          <p>IČO: {t.supplier?.ico}</p>
                          <div className="flex items-center flex-wrap gap-2 mt-2 border-t border-line pt-3">
                            <span className="font-mono text-xs text-muted">
                              {new Date(t.date_published).toLocaleDateString('sk-SK')}
                            </span>
                            {t.source_url ? (
                              <a
                                href={t.source_url?.startsWith('http') ? t.source_url : `https://${t.source_url}`}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                title={t.source_type === 'WEB_INVOICE' ? 'Otvoriť faktúru' : 'Otvoriť zmluvu z CRZ'}
                                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${t.source_type === 'WEB_INVOICE' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}
                              >
                                {t.source_type === 'WEB_INVOICE' ? 'Faktúra' : 'CRZ'}
                                <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            ) : (
                              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${t.source_type === 'WEB_INVOICE' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
                                {t.source_type === 'WEB_INVOICE' ? 'Faktúra' : 'CRZ'}
                              </span>
                            )}
                            {t.suspicious && (
                              <InfoIcon icon={AlertTriangle} colorClass="text-red-400" label="Chýba zmluva v CRZ">
                                Krížová kontrola: Dodávateľ nemá v databáze žiadnu zmluvu z CRZ, no napriek tomu fakturuje.
                              </InfoIcon>
                            )}
                            {t.amount_eur >= 100000 && t.supplier?.ico && !t.supplier.ico.startsWith('NO_ICO_') && (
                              <RpvsBadge ico={t.supplier.ico} name={t.supplier?.name} compact />
                            )}
                          </div>
                        </div>
                        <div className="mt-4 pt-4 border-t border-line flex items-center justify-between">
                        <span className="text-sm text-muted font-medium">Spolu</span>
                        <div className="flex items-center">
                          <span className="text-lg font-bold text-body bg-elevated border border-line px-2 py-1 rounded">
                            {formatEur(t.amount_eur)}
                          </span>
                          <VerifiedBadge source={t.source_type === 'CRZ_CONTRACT' ? 'CRZ (Data.gov.sk)' : 'Mesto Martin (Faktúry)'} date={new Date(t.date_published).toLocaleDateString('sk-SK')} />
                        </div>
                      </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center text-muted p-8 bg-card border border-line rounded-xl">Pre zadané kritériá sa nenašli žiadne záznamy.</div>
                  )}
                </div>
              </div>
              
              {/* PAGINATION */}
              {totalPages > 1 && (
                <div className="px-6 py-4 border-t border-line flex items-center justify-between">
                  <p className="text-sm text-muted">
                    Zobrazujem <span className="font-medium text-body">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> až <span className="font-medium text-body">{Math.min(currentPage * ITEMS_PER_PAGE, filteredTransactions.length)}</span> z <span className="font-medium text-body">{filteredTransactions.length}</span> výsledkov
                  </p>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1 border border-line text-sm font-medium rounded hover:bg-elevated text-body disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Predchádzajúca
                    </button>
                    <button 
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1 border border-line text-sm font-medium rounded hover:bg-elevated text-body disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Ďalšia
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* WATCHDOG FOOTER */}
            <div className="mt-8 bg-card rounded-2xl p-6 shadow-lg text-body border border-line">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                <h3 className="text-lg font-bold text-body tracking-wide">Watchdog (Pre pokročilých)</h3>
              </div>
              <p className="text-sm text-muted mb-4 max-w-3xl">
                Rýchly filter na subjekty, ktoré sú historicky spájané s mestom Martin, rozsiahlymi verejnými zákazkami alebo kontroverznými zmluvami. Kliknutím na tlačidlo okamžite vyhľadáte ich prítomnosť v databáze.
              </p>
              <div className="flex flex-wrap gap-3">
                <button 
                  onClick={() => { setSearchTerm("brantner"); setCurrentPage(1); window.scrollTo({top: 500, behavior: 'smooth'}); }}
                  className="bg-elevated hover:bg-elevated text-body px-4 py-2 rounded-lg text-sm font-medium transition-colors border border-line flex items-center gap-2"
                >
                  <Search className="w-4 h-4" aria-hidden="true" /> Brantner (Odpad)
                </button>
                <button 
                  onClick={() => { setSearchTerm("tora legal"); setCurrentPage(1); window.scrollTo({top: 500, behavior: 'smooth'}); }}
                  className="bg-elevated hover:bg-elevated text-body px-4 py-2 rounded-lg text-sm font-medium transition-colors border border-line flex items-center gap-2"
                >
                  <Search className="w-4 h-4" aria-hidden="true" /> TORA LEGAL
                </button>
                <button 
                  onClick={() => { setSearchTerm("pk faktoring"); setCurrentPage(1); window.scrollTo({top: 500, behavior: 'smooth'}); }}
                  className="bg-elevated hover:bg-elevated text-body px-4 py-2 rounded-lg text-sm font-medium transition-colors border border-line flex items-center gap-2"
                >
                  <Search className="w-4 h-4" aria-hidden="true" /> PK Faktoring
                </button>
              </div>
            </div>

          </div>
        )}
      </main>
    </div>
  );
}
