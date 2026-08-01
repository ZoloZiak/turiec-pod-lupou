"use client";

import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Search, FileText, Building2, TrendingUp, Filter, AlertTriangle } from "lucide-react";
import Link from "next/link";

export default function Dashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedIco, setSelectedIco] = useState("");
  const [selectedSupplierName, setSelectedSupplierName] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
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
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* HEADER */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Search className="w-6 h-6 text-blue-600" />
            <h1 className="text-xl font-bold tracking-tight text-slate-800">Turiec pod Lupou</h1>
          </div>
          <div className="flex gap-4 items-center">
            <a href="/admin" className="text-sm font-medium bg-slate-100 hover:bg-slate-200 px-4 py-2 rounded-lg text-slate-700 transition-colors">
              Administrácia
            </a>
          </div>
        </div>
        
        {/* ENTITY FILTER BAR */}
        <div className="bg-white/80 backdrop-blur-md border-b border-slate-200 w-full overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex gap-2">
            <button
              onClick={() => setSelectedIco("")}
              className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all ${selectedIco === "" ? "bg-blue-600 text-white shadow-md ring-2 ring-blue-600 ring-offset-1" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
            >
              Všetky organizácie
            </button>
            {data?.entities?.map((e: any) => (
              <button
                key={e.ico}
                onClick={() => setSelectedIco(e.ico)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all ${selectedIco === e.ico ? "bg-blue-600 text-white shadow-md ring-2 ring-blue-600 ring-offset-1" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
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
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            
            {/* STATS CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-start gap-4">
                <div className="p-3 bg-red-100 rounded-xl">
                  <TrendingUp className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500">Celkové výdavky</p>
                  <h3 className="text-3xl font-bold text-slate-800 mt-1">{formatEur(data.stats.totalSpent)}</h3>
                </div>
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-start gap-4">
                <div className="p-3 bg-blue-100 rounded-xl">
                  <FileText className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500">Počet zmlúv v CRZ</p>
                  <h3 className="text-3xl font-bold text-slate-800 mt-1">{data.stats.totalContracts}</h3>
                </div>
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-start gap-4">
                <div className="p-3 bg-emerald-100 rounded-xl">
                  <Building2 className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500">Sledovaných subjektov</p>
                  <h3 className="text-3xl font-bold text-slate-800 mt-1">{data.stats.entitiesCount}</h3>
                </div>
              </div>
            </div>

            {/* CHARTS */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* BAR CHART */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <h3 className="text-lg font-semibold mb-6">Top 10 príjemcov (Dodávatelia)</h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart 
                      data={data.topSuppliers} 
                      layout="vertical" 
                      margin={{ left: 50 }}
                    >
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" width={150} tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                      <Tooltip 
                        formatter={(val: any) => formatEur(val as number)} 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} 
                        cursor={{ fill: '#f1f5f9' }}
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
                            opacity={selectedSupplierName ? (selectedSupplierName === entry.name ? 1 : 0.3) : 1}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* PIE CHART (Placeholder, can be mapped to types later) */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-center items-center">
                 <h3 className="text-lg font-semibold mb-2 self-start">Rozdelenie financií</h3>
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
                 <p className="text-xs text-slate-400 text-center mt-2">Zobrazených top 5 dodávateľov</p>
              </div>
            </div>

            {/* TRANSACTIONS TABLE */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                <h3 className="text-lg font-semibold whitespace-nowrap">Najnovšie zverejnené zmluvy a faktúry</h3>
                <div className="flex items-center gap-3 w-full md:w-auto">
                  {selectedSupplierName && (
                    <button 
                      onClick={() => {
                        setSelectedSupplierName(null);
                        setCurrentPage(1);
                      }}
                      className="flex items-center gap-1 text-sm bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full font-medium hover:bg-blue-100 transition-colors whitespace-nowrap"
                    >
                      Filtrujem: {selectedSupplierName} <span className="ml-1 text-lg leading-none">&times;</span>
                    </button>
                  )}
                  <div className="relative w-full md:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                      type="text" 
                      placeholder="Hľadať zmluvu alebo firmu..." 
                      value={searchTerm}
                      onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="w-full pl-9 pr-4 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
                    />
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-100">
                    <tr>
                      <th className="px-6 py-4 font-medium">Predmet zákazky</th>
                      <th className="px-6 py-4 font-medium">Dodávateľ</th>
                      <th className="px-6 py-4 font-medium text-right">Suma</th>
                      <th className="px-6 py-4 font-medium">Zdroj a Dátum</th>
                    </tr>
                  </thead>
                   <tbody className="divide-y divide-slate-100">
                    {paginatedTransactions.length > 0 ? (
                      paginatedTransactions.map((t: any) => (
                        <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4">
                            <p className="font-medium text-slate-800 line-clamp-2" title={t.subject}>{t.subject}</p>
                            <p className="text-xs text-slate-500 mt-1">Odberateľ: {t.buyer?.name}</p>
                          </td>
                          <td className="px-6 py-4 text-slate-600 font-medium">
                            <Link href={`/dodavatel/${t.supplier?.ico}`} className="text-blue-600 hover:underline font-bold text-base">
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
                              {t.amount_eur >= 100000 && (
                                <div className="inline-flex items-center gap-1 px-2 py-1 bg-amber-50 text-amber-700 text-xs font-semibold rounded border border-amber-100" title="Zákonná povinnosť: Zmluvy alebo faktúry nad 100 000€ vyžadujú, aby bol dodávateľ zapísaný v Registri partnerov verejného sektora. Skontroluj to kliknutím na RPVS link vyššie.">
                                  <AlertTriangle className="w-3 h-3" />
                                  Zákazka nad 100k € (nutné RPVS)
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-red-100 text-red-800">
                              {formatEur(t.amount_eur)}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col gap-1 items-start">
                              {t.source_type === 'WEB_INVOICE' ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
                                  Faktúra z webu
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                  CRZ Zmluva
                                </span>
                              )}
                              <a href={t.source_url} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline mt-1">
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
              
              {/* PAGINATION */}
              {totalPages > 1 && (
                <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
                  <p className="text-sm text-slate-500">
                    Zobrazujem <span className="font-medium text-slate-900">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> až <span className="font-medium text-slate-900">{Math.min(currentPage * ITEMS_PER_PAGE, filteredTransactions.length)}</span> z <span className="font-medium text-slate-900">{filteredTransactions.length}</span> výsledkov
                  </p>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1 border border-slate-200 text-sm font-medium rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Predchádzajúca
                    </button>
                    <button 
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1 border border-slate-200 text-sm font-medium rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
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
