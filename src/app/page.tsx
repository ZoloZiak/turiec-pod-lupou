"use client";

import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Search, FileText, Building2, TrendingUp, Filter, AlertTriangle, ExternalLink, Calendar, Link as LinkIcon, CheckCircle, ShieldAlert, Menu, X, Lightbulb, ShieldCheck, Globe, Users, Activity } from "lucide-react";
import Link from "next/link";
import RpvsBadge from "./components/RpvsBadge";
import VerifiedBadge from "./components/VerifiedBadge";
import MacroStats from "./components/MacroStats";
import NumberFlow from "@number-flow/react";
import SpotlightCard from "./components/SpotlightCard";

export default function Dashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedIco, setSelectedIco] = useState("");
  const [selectedSupplierName, setSelectedSupplierName] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const ITEMS_PER_PAGE = 20;

  // Zrušiť filtre pri zmene organizácie
  useEffect(() => {
    setSelectedSupplierName(null);
    setSearchTerm("");
    setCurrentPage(1);
    fetchData(selectedIco);
  }, [selectedIco]);

  // Compute filtered transactions
  const filteredTransactions = data?.transactions?.filter((t: any) => {
    if (selectedSupplierName && t.supplier?.name !== selectedSupplierName) return false;
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

  const fetchData = async (ico: string) => {
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
  };

  const formatEur = (val: number) => {
    return new Intl.NumberFormat("sk-SK", { style: "currency", currency: "EUR" }).format(val);
  };

  const COLORS = ["#f87171", "#fb923c", "#fbbf24", "#34d399", "#38bdf8", "#818cf8", "#a78bfa", "#e879f9"];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-emerald-500/30">
      {/* HEADER */}
      <header className="bg-slate-900/80 backdrop-blur-md border-b border-slate-800 sticky top-0 z-20 shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Search className="w-6 h-6 text-emerald-400" />
            <h1 className="text-xl font-bold tracking-tight text-white drop-shadow-md">Turiec pod Lupou</h1>
          </div>

          {/* DESKTOP BUTTONS */}
          <div className="hidden sm:flex gap-4 items-center">
            <Link href="/slubomer" className="text-sm font-medium bg-amber-500/10 hover:bg-amber-500/20 px-4 py-2 rounded-lg text-amber-400 border border-amber-500/20 transition-all flex items-center gap-2">
              <Lightbulb className="w-4 h-4" />
              Sľubomer
            </Link>
            <Link href="/majetky" className="text-sm font-medium bg-indigo-500/10 hover:bg-indigo-500/20 px-4 py-2 rounded-lg text-indigo-400 border border-indigo-500/20 transition-all flex items-center gap-2">
              <ShieldAlert className="w-4 h-4" />
              Majetky
            </Link>
            <Link href="/upozornenia" className="text-sm font-medium bg-red-500/10 hover:bg-red-500/20 px-4 py-2 rounded-lg text-red-400 border border-red-500/20 transition-all flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Upozornenia
            </Link>
            <Link href="/admin" className="text-sm font-medium bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-lg text-slate-300 border border-slate-700 transition-all">
              Administrácia
            </Link>
          </div>

          {/* MOBILE MENU TOGGLE */}
          <div className="sm:flex md:hidden items-center">
             <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-2 text-slate-400 hover:text-white rounded-lg">
               {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
             </button>
          </div>
        </div>
        
        {/* MOBILE DROPDOWN MENU */}
        {isMenuOpen && (
          <div className="md:hidden border-t border-slate-800 bg-slate-900 px-4 py-4 space-y-4 shadow-lg absolute w-full left-0">
             <div className="flex flex-col gap-2">
               <a href="/slubomer" className="text-sm font-medium bg-amber-50 hover:bg-amber-100 px-4 py-2 rounded-lg text-amber-600 transition-colors flex items-center justify-center gap-2">
                 <Lightbulb className="w-4 h-4" />
                 Sľubomer
               </a>
               <a href="/upozornenia" className="text-sm font-medium bg-red-50 hover:bg-red-100 px-4 py-2 rounded-lg text-red-600 transition-colors flex items-center justify-center gap-2">
                 <AlertTriangle className="w-4 h-4" />
                 Upozornenia
               </a>
               <a href="/admin" className="text-sm font-medium bg-slate-100 hover:bg-slate-200 px-4 py-2 rounded-lg text-slate-700 transition-colors text-center">
                 Administrácia
               </a>
             </div>
             
             <div className="pt-4 border-t border-slate-100">
               <p className="text-xs font-bold text-slate-500 uppercase mb-3">Vyberte organizáciu</p>
               <div className="flex flex-col gap-2">
                  <button
                    onClick={() => { setSelectedIco(""); setIsMenuOpen(false); }}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all text-left ${selectedIco === "" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                  >
                    Všetky organizácie
                  </button>
                  {data?.entities?.map((e: any) => (
                    <button
                      key={e.ico}
                      onClick={() => { setSelectedIco(e.ico); setIsMenuOpen(false); }}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all text-left ${selectedIco === e.ico ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                    >
                      {e.name}
                    </button>
                  ))}
               </div>
             </div>
          </div>
        )}

        {/* DESKTOP ENTITY FILTER BAR */}
        <div className="hidden md:block bg-slate-900/80 backdrop-blur-md border-t md:border-t-0 border-slate-800 w-full">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedIco("")}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${selectedIco === "" ? "bg-blue-600 text-white shadow-md ring-2 ring-blue-600 ring-offset-1" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
            >
              Všetky organizácie
            </button>
            {data?.entities?.map((e: any) => (
              <button
                key={e.ico}
                onClick={() => setSelectedIco(e.ico)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${selectedIco === e.ico ? "bg-emerald-500 text-white shadow-md ring-2 ring-emerald-500 ring-offset-1 ring-offset-slate-900" : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white"}`}
              >
                {e.name}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
          </div>
        ) : (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            
            {/* LICZBA-BOHATER (Hero Stat) */}
            <SpotlightCard className="bg-slate-900 border border-slate-800 rounded-3xl p-10 flex flex-col items-center justify-center text-center mb-8 shadow-2xl" glowColor="rgba(16, 185, 129, 0.2)">
              <p className="text-emerald-300 font-bold uppercase tracking-widest text-sm mb-4">Celkový objem zákaziek a zmlúv (Terminal)</p>
              <div className="text-6xl md:text-8xl font-black text-white font-mono tracking-tighter drop-shadow-[0_0_15px_rgba(16,185,129,0.4)]">
                <NumberFlow 
                  value={data.stats.totalSpent} 
                  format={{ style: "currency", currency: "EUR", maximumFractionDigits: 0 }} 
                />
              </div>
              <div className="mt-6 flex items-center gap-3 text-slate-400 text-sm">
                <span className="flex items-center gap-1"><CheckCircle className="w-4 h-4 text-emerald-500" /> Živé dáta</span>
                <span className="flex items-center gap-1"><ShieldCheck className="w-4 h-4 text-emerald-500" /> Overené CRZ</span>
              </div>
            </SpotlightCard>

            {/* SECONDARY STATS CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <SpotlightCard className="bg-slate-900 p-6 rounded-2xl shadow-lg border border-slate-800 flex items-start gap-4">
                <div className="p-3 bg-blue-500/10 rounded-xl border border-blue-500/20">
                  <FileText className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-400">Počet analyzovaných zmlúv v CRZ</p>
                  <h3 className="text-4xl font-bold text-white mt-1">
                    <NumberFlow value={data.stats.totalContracts} />
                  </h3>
                </div>
              </SpotlightCard>
              <SpotlightCard className="bg-slate-900 p-6 rounded-2xl shadow-lg border border-slate-800 flex items-start gap-4">
                <div className="p-3 bg-purple-500/10 rounded-xl border border-purple-500/20">
                  <Building2 className="w-6 h-6 text-purple-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-400">Sledovaných subjektov v meste</p>
                  <h3 className="text-4xl font-bold text-white mt-1">
                    <NumberFlow value={data.stats.entitiesCount} />
                  </h3>
                </div>
              </SpotlightCard>
            </div>
            
            <div className="mt-8">
              <MacroStats />
            </div>

            {/* Z-DYKTY NAVIGAČNÝ HUB */}
            <div className="mt-8 mb-8">
              <h2 className="text-xl font-bold mb-4 text-white">Verejná kontrola (Fáza 7)</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Link href="/podniky" className="group h-full block">
                  <SpotlightCard className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col sm:flex-row items-center gap-3 transition-all h-full" glowColor="rgba(16, 185, 129, 0.2)">
                    <div className="p-2 bg-emerald-500/10 rounded-lg group-hover:bg-emerald-500/20 transition-colors border border-emerald-500/20">
                      <Activity className="w-5 h-5 text-emerald-400" />
                    </div>
                    <span className="font-semibold text-slate-300 group-hover:text-white">Mestské podniky</span>
                  </SpotlightCard>
                </Link>
                <Link href="/nku" className="group h-full block">
                  <SpotlightCard className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col sm:flex-row items-center gap-3 transition-all h-full" glowColor="rgba(239, 68, 68, 0.2)">
                    <div className="p-2 bg-red-500/10 rounded-lg group-hover:bg-red-500/20 transition-colors border border-red-500/20">
                      <ShieldAlert className="w-5 h-5 text-red-400" />
                    </div>
                    <span className="font-semibold text-slate-300 group-hover:text-white">Kontroly NKÚ</span>
                  </SpotlightCard>
                </Link>
                <Link href="/eurofondy" className="group h-full block">
                  <SpotlightCard className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col sm:flex-row items-center gap-3 transition-all h-full" glowColor="rgba(59, 130, 246, 0.2)">
                    <div className="p-2 bg-blue-500/10 rounded-lg group-hover:bg-blue-500/20 transition-colors border border-blue-500/20">
                      <Globe className="w-5 h-5 text-blue-400" />
                    </div>
                    <span className="font-semibold text-slate-300 group-hover:text-white">Eurofondy</span>
                  </SpotlightCard>
                </Link>
                <Link href="/poslanci" className="group h-full block">
                  <SpotlightCard className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col sm:flex-row items-center gap-3 transition-all h-full" glowColor="rgba(168, 85, 247, 0.2)">
                    <div className="p-2 bg-purple-500/10 rounded-lg group-hover:bg-purple-500/20 transition-colors border border-purple-500/20">
                      <Users className="w-5 h-5 text-purple-400" />
                    </div>
                    <span className="font-semibold text-slate-300 group-hover:text-white">Hlasovania MsZ</span>
                  </SpotlightCard>
                </Link>
              </div>
            </div>

            {/* CHARTS */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* BAR CHART */}
              <SpotlightCard className="bg-slate-900 p-6 rounded-2xl shadow-lg border border-slate-800">
                <h3 className="text-lg font-semibold mb-6 text-white">Top 10 príjemcov (Dodávatelia)</h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart 
                      data={data.topSuppliers} 
                      layout="vertical" 
                      margin={{ left: 50 }}
                    >
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" width={150} tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                      <Tooltip 
                        formatter={(val: any) => formatEur(val as number)} 
                        contentStyle={{ borderRadius: '12px', backgroundColor: '#0f172a', border: '1px solid #334155', color: '#f8fafc', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.5)' }} 
                        cursor={{ fill: '#1e293b' }}
                      />
                      <Bar 
                        dataKey="value" 
                        radius={[0, 4, 4, 0]} 
                        className="cursor-pointer"
                        onClick={(entry: any) => {
                          if (entry?.name) {
                            setSelectedSupplierName(entry.name === selectedSupplierName ? null : entry.name);
                          }
                        }}
                      >
                        {data.topSuppliers.map((entry: any, index: number) => (
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
              <SpotlightCard className="bg-slate-900 p-6 rounded-2xl shadow-lg border border-slate-800 flex flex-col justify-center items-center">
                 <h3 className="text-lg font-semibold mb-2 self-start text-white">Rozdelenie financií</h3>
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
                        onClick={(entry: any) => {
                          if (entry?.name) {
                            setSelectedSupplierName(entry.name === selectedSupplierName ? null : entry.name);
                          }
                        }}
                      >
                        {data.topSuppliers.slice(0,5).map((entry: any, index: number) => (
                          <Cell 
                            key={`pie-${index}`} 
                            fill={COLORS[index % COLORS.length]} 
                            opacity={selectedSupplierName ? (selectedSupplierName === entry.name ? 1 : 0.3) : 1}
                          />
                        ))}
                      </Pie>
                      <Tooltip formatter={(val: any) => formatEur(val as number)} />
                    </PieChart>
                  </ResponsiveContainer>
                 </div>
                 <p className="text-xs text-slate-500 text-center mt-2">Zobrazených top 5 dodávateľov</p>
              </SpotlightCard>
            </div>

            {/* TRANSACTIONS TABLE */}
            <div className="bg-slate-900 rounded-2xl shadow-lg border border-slate-800 overflow-hidden">
              <div className="p-6 border-b border-slate-800 flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                <h3 className="text-lg font-semibold whitespace-nowrap text-white">Najnovšie zverejnené zmluvy a faktúry</h3>
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
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input 
                      type="text" 
                      placeholder="Hľadať zmluvu alebo firmu..." 
                      value={searchTerm}
                      onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="w-full pl-9 pr-4 py-1.5 text-sm bg-slate-800 border border-slate-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-shadow placeholder:text-slate-500"
                    />
                  </div>
                </div>
              </div>
              <div className="w-full">
                {/* DESKTOP TABLE VIEW */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm text-left">
                  <thead className="text-xs text-slate-400 uppercase bg-slate-950/50 border-b border-slate-800">
                    <tr>
                      <th className="px-6 py-4 font-medium">Predmet zákazky</th>
                      <th className="px-6 py-4 font-medium">Dodávateľ</th>
                      <th className="px-6 py-4 font-medium text-right">Suma</th>
                      <th className="px-6 py-4 font-medium">Zdroj a Dátum</th>
                    </tr>
                  </thead>
                   <tbody className="divide-y divide-slate-800">
                    {paginatedTransactions.length > 0 ? (
                      paginatedTransactions.map((t: any) => (
                        <tr key={t.id} className="hover:bg-slate-800/50 transition-colors">
                          <td className="px-6 py-4">
                            <p className="font-medium text-slate-200 line-clamp-2" title={t.subject}>{t.subject}</p>
                            <p className="text-xs text-slate-500 mt-1">Odberateľ: {t.buyer?.name}</p>
                          </td>
                          <td className="px-6 py-4 text-slate-400 font-medium">
                            <Link href={`/dodavatel/${t.supplier?.ico}`} className="text-emerald-400 hover:text-emerald-300 hover:underline font-bold text-base">
                              {t.supplier?.name || "Neznámy"}
                            </Link>
                            <div className="text-xs text-slate-400 font-normal mt-1 flex items-center gap-2">
                              <span>IČO: {t.supplier?.ico}</span>
                              {t.supplier?.ico && !t.supplier.ico.startsWith('NO_ICO_') && (
                                <div className="flex gap-2 ml-2 border-l pl-2 border-slate-200">
                                  <a href={`https://orsr.sk/hladaj_ico.asp?ICO=${t.supplier.ico}&SID=0`} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">ORSR</a>
                                  <a href={`https://rpvs.gov.sk/rpvs/Partner/Partner/Vyhladavanie?NazovPodniku=&Ico=${t.supplier.ico}`} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">RPVS</a>
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
                              {t.amount_eur >= 100000 && t.supplier?.ico && (
                                <RpvsBadge ico={t.supplier.ico} />
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end">
                            <span className="font-bold text-white bg-slate-800 px-2 py-1 rounded border border-slate-700">
                              {formatEur(t.amount_eur)}
                            </span>
                            <VerifiedBadge source={t.source_type === 'CRZ_CONTRACT' ? 'CRZ (Data.gov.sk)' : 'Mesto Martin (Faktúry)'} date={new Date(t.date_published).toLocaleDateString('sk-SK')} />
                          </div>
                        </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col gap-1 items-start">
                              {t.source_type === 'WEB_INVOICE' ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-500/10 border border-amber-500/20 text-amber-400">
                                  Faktúra z webu
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                                  CRZ Zmluva
                                </span>
                              )}
                              <a href={t.source_url?.startsWith('http') ? t.source_url : `https://${t.source_url}`} target="_blank" rel="noreferrer" className="text-xs text-slate-400 hover:text-white transition-colors mt-1">
                                {new Date(t.date_published).toLocaleDateString('sk-SK')}
                              </a>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                          Pre zadané kritériá sa nenašli žiadne záznamy.
                        </td>
                      </tr>
                    )}
                    </tbody>
                  </table>
                </div>

                {/* MOBILE CARD VIEW */}
                <div className="md:hidden flex flex-col gap-4 p-4 border-t border-slate-800 bg-slate-950">
                  {paginatedTransactions.length > 0 ? (
                    paginatedTransactions.map((t: any) => (
                      <div key={t.id} className="bg-slate-900 p-4 rounded-xl shadow-sm border border-slate-800">
                        <div className="flex justify-between items-start mb-2">
                          <Link href={`/dodavatel/${t.supplier?.ico}`} className="text-blue-600 hover:underline font-bold text-base truncate pr-2">
                            {t.supplier?.name || "Neznámy"}
                          </Link>
                        </div>
                        <p className="text-sm font-medium text-slate-800 mb-2">{t.subject}</p>
                        <div className="flex flex-col gap-2 text-xs text-slate-500">
                          <p>Odberateľ: {t.buyer?.name}</p>
                          <p>IČO: {t.supplier?.ico}</p>
                          <div className="flex justify-between items-center mt-2 border-t border-slate-800 pt-3">
                            <div className="flex flex-col gap-1.5">
                              {t.source_type === 'WEB_INVOICE' ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20 self-start">Faktúra z webu</span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 self-start">CRZ Zmluva</span>
                              )}
                              <a href={t.source_url?.startsWith('http') ? t.source_url : `https://${t.source_url}`} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-white transition-colors font-medium">
                                {new Date(t.date_published).toLocaleDateString('sk-SK')}
                              </a>
                            </div>
                            <div className="flex flex-col gap-1.5 items-end">
                              {t.suspicious && (
                                <span className="text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-100 flex items-center gap-1 font-bold">
                                  <AlertTriangle className="w-3 h-3" /> Chýba zmluva
                                </span>
                              )}
                              {t.amount_eur >= 100000 && t.supplier?.ico && (
                                <RpvsBadge ico={t.supplier.ico} />
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-between">
                        <span className="text-sm text-slate-500 font-medium">Spolu</span>
                        <div className="flex items-center">
                          <span className="text-lg font-bold text-white bg-slate-800 border border-slate-700 px-2 py-1 rounded">
                            {formatEur(t.amount_eur)}
                          </span>
                          <VerifiedBadge source={t.source_type === 'CRZ_CONTRACT' ? 'CRZ (Data.gov.sk)' : 'Mesto Martin (Faktúry)'} date={new Date(t.date_published).toLocaleDateString('sk-SK')} />
                        </div>
                      </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center text-slate-500 p-8 bg-slate-900 border border-slate-800 rounded-xl">Pre zadané kritériá sa nenašli žiadne záznamy.</div>
                  )}
                </div>
              </div>
              
              {/* PAGINATION */}
              {totalPages > 1 && (
                <div className="px-6 py-4 border-t border-slate-800 flex items-center justify-between">
                  <p className="text-sm text-slate-500">
                    Zobrazujem <span className="font-medium text-white">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> až <span className="font-medium text-white">{Math.min(currentPage * ITEMS_PER_PAGE, filteredTransactions.length)}</span> z <span className="font-medium text-white">{filteredTransactions.length}</span> výsledkov
                  </p>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1 border border-slate-700 text-sm font-medium rounded hover:bg-slate-800 text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Predchádzajúca
                    </button>
                    <button 
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1 border border-slate-700 text-sm font-medium rounded hover:bg-slate-800 text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Ďalšia
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* WATCHDOG FOOTER */}
            <div className="mt-8 bg-slate-900 rounded-2xl p-6 shadow-lg text-slate-300 border border-slate-800">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                <h3 className="text-lg font-bold text-white tracking-wide">Watchdog (Pre pokročilých)</h3>
              </div>
              <p className="text-sm text-slate-400 mb-4 max-w-3xl">
                Rýchly filter na subjekty, ktoré sú historicky spájané s mestom Martin, rozsiahlymi verejnými zákazkami alebo kontroverznými zmluvami. Kliknutím na tlačidlo okamžite vyhľadáte ich prítomnosť v databáze.
              </p>
              <div className="flex flex-wrap gap-3">
                <button 
                  onClick={() => { setSearchTerm("brantner"); setCurrentPage(1); window.scrollTo({top: 500, behavior: 'smooth'}); }}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2 rounded-lg text-sm font-medium transition-colors border border-slate-700 flex items-center gap-2"
                >
                  <Search className="w-4 h-4" /> Brantner (Odpad)
                </button>
                <button 
                  onClick={() => { setSearchTerm("tora legal"); setCurrentPage(1); window.scrollTo({top: 500, behavior: 'smooth'}); }}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2 rounded-lg text-sm font-medium transition-colors border border-slate-700 flex items-center gap-2"
                >
                  <Search className="w-4 h-4" /> TORA LEGAL
                </button>
                <button 
                  onClick={() => { setSearchTerm("pk faktoring"); setCurrentPage(1); window.scrollTo({top: 500, behavior: 'smooth'}); }}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2 rounded-lg text-sm font-medium transition-colors border border-slate-700 flex items-center gap-2"
                >
                  <Search className="w-4 h-4" /> PK Faktoring
                </button>
              </div>
            </div>

          </div>
        )}
      </main>
    </div>
  );
}
