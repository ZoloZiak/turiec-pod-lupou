"use client";

import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Search, FileText, Building2, TrendingUp, Filter, AlertTriangle } from "lucide-react";

export default function Dashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedIco, setSelectedIco] = useState("");
  const [selectedSupplierName, setSelectedSupplierName] = useState<string | null>(null);

  // Zrušiť filter dodávateľa pri zmene organizácie
  useEffect(() => {
    setSelectedSupplierName(null);
    fetchData(selectedIco);
  }, [selectedIco]);

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
                      onClick={(e: any) => {
                        if (e?.activePayload?.[0]?.payload?.name) {
                          const name = e.activePayload[0].payload.name;
                          setSelectedSupplierName(name === selectedSupplierName ? null : name);
                        }
                      }}
                    >
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" width={150} tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                      <Tooltip 
                        formatter={(val: any) => formatEur(val as number)} 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} 
                        cursor={{ fill: '#f1f5f9' }}
                      />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]} className="cursor-pointer">
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
              <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                <h3 className="text-lg font-semibold">Najnovšie zverejnené zmluvy a faktúry</h3>
                {selectedSupplierName && (
                  <button 
                    onClick={() => setSelectedSupplierName(null)}
                    className="flex items-center gap-1 text-sm bg-blue-50 text-blue-700 px-3 py-1 rounded-full font-medium hover:bg-blue-100 transition-colors"
                  >
                    Filtrujem: {selectedSupplierName} <span className="ml-1 text-lg leading-none">&times;</span>
                  </button>
                )}
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
                    {(selectedSupplierName 
                      ? data.transactions.filter((t: any) => t.supplier?.name === selectedSupplierName)
                      : data.transactions
                    ).slice(0, 15).map((t: any) => (
                      <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4">
                          <p className="font-medium text-slate-800 line-clamp-2" title={t.subject}>{t.subject}</p>
                          <p className="text-xs text-slate-500 mt-1">Odberateľ: {t.buyer?.name}</p>
                        </td>
                        <td className="px-6 py-4 text-slate-600 font-medium">
                          {t.supplier?.name || "Neznámy"}
                          <div className="text-xs text-slate-400 font-normal mt-1">IČO: {t.supplier?.ico}</div>
                          {t.suspicious && (
                            <div className="mt-2 inline-flex items-center gap-1 px-2 py-1 bg-red-50 text-red-700 text-xs font-semibold rounded border border-red-100" title="Krížová kontrola: Dodávateľ nemá v databáze žiadnu zmluvu z CRZ, no napriek tomu fakturuje.">
                              <AlertTriangle className="w-3 h-3" />
                              Chýba zmluva v CRZ!
                            </div>
                          )}
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
                            <a href={t.source_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-xs font-medium flex items-center gap-1 mt-1">
                              Otvoriť dokument &rarr;
                            </a>
                            <span className="text-xs text-slate-400 mt-1">
                              {new Date(t.date_published).toLocaleDateString('sk-SK')}
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}
      </main>
    </div>
  );
}
