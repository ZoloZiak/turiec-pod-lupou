"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { ArrowLeft, Building2, TrendingUp, AlertTriangle, Search, Share2, Copy, Check } from "lucide-react";
import Link from "next/link";

export default function SupplierProfilePage() {
  const params = useParams();
  const ico = params.ico as string;

  const [data, setData] = useState<any>(null);
  const [finstatData, setFinstatData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (ico) {
      fetchSupplierData(ico);
    }
  }, [ico]);

  const handleShare = () => {
    if (!data?.supplier) return;
    const shareText = `🔎 Turiec pod Lupou: Dodávateľ ${data.supplier.name} zrealizoval pre verejný sektor v Turci zmluvy za ${formatEur(data.stats.totalAmount)} (${data.stats.totalCount} zákaziek). Pozri detail: ${window.location.href}`;
    navigator.clipboard.writeText(shareText);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const fetchSupplierData = async (icoStr: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/supplier?ico=${icoStr}`);
      const json = await res.json();
      if (json.success) setData(json);

      // Súbežné fetchnutie Finstat live dát cez cloudscraper API
      try {
        const finstatRes = await fetch(`/api/finstat/${icoStr}`);
        const finstatJson = await finstatRes.json();
        if (finstatJson.success) setFinstatData(finstatJson.data);
      } catch (e) {
        console.error("Finstat nepodarilo načítať", e);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const formatEur = (val: number) => {
    return new Intl.NumberFormat("sk-SK", { style: "currency", currency: "EUR" }).format(val);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-500 font-medium animate-pulse">Načítavam profil...</div>
      </div>
    );
  }

  if (!data || !data.supplier) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center flex-col gap-4">
        <h2 className="text-xl font-bold text-slate-800">Dodávateľ nenájdený</h2>
        <Link href="/" className="text-blue-600 hover:underline flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" /> Späť na prehľad
        </Link>
      </div>
    );
  }

  const { supplier, transactions, stats } = data;
  const isNoIco = supplier.ico.startsWith('NO_ICO_');

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-12">
      {/* HEADER */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="p-2 -ml-2 rounded-full hover:bg-slate-100 text-slate-500 transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-2">
              <Building2 className="w-6 h-6 text-blue-600" />
              <h1 className="text-xl font-bold tracking-tight text-slate-800 truncate">
                {supplier.name}
              </h1>
            </div>
          </div>

          <button
            onClick={handleShare}
            className="flex items-center gap-2 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg transition-all shadow-sm active:scale-95"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-white" />
                <span>Kopírované do schránky!</span>
              </>
            ) : (
              <>
                <Share2 className="w-4 h-4" />
                <span className="hidden sm:inline">Zdieľať profil</span>
              </>
            )}
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 space-y-6">
        
        {/* KPI CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-center">
            <p className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-1">Identifikácia</p>
            <p className="text-2xl font-bold font-mono text-slate-800">{isNoIco ? "Neznáme IČO" : supplier.ico}</p>
            {!isNoIco && (
              <div className="flex gap-3 mt-3">
                <a href={`https://orsr.sk/hladaj_ico.asp?ICO=${supplier.ico}&SID=0`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline font-medium">
                  <Search className="w-3 h-3" /> ORSR
                </a>
                <a href={`https://rpvs.gov.sk/rpvs/Partner/Partner/Vyhladavanie?NazovPodniku=&Ico=${supplier.ico}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline font-medium">
                  <Search className="w-3 h-3" /> RPVS
                </a>
                <a href={`https://finstat.sk/${supplier.ico}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline font-medium">
                  <Search className="w-3 h-3" /> FinStat
                </a>
              </div>
            )}
          </div>
          
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-center">
            <p className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-1">Celkové príjmy z mesta</p>
            <p className="text-3xl font-bold text-slate-900">{formatEur(stats.totalAmount)}</p>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-center">
            <p className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-1">Počet zákaziek</p>
            <p className="text-3xl font-bold text-slate-900">{stats.totalCount}</p>
          </div>

          <div className="bg-gradient-to-br from-indigo-50 to-white p-6 rounded-2xl shadow-sm border border-indigo-100 flex flex-col justify-center relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <TrendingUp className="w-16 h-16 text-indigo-600" />
            </div>
            <p className="text-sm font-medium text-indigo-700 uppercase tracking-wider mb-1 relative z-10">Zisk (FinStat AI Proxy)</p>
            {finstatData === null ? (
              <p className="text-sm text-slate-500 animate-pulse mt-2">Analyzujem živé dáta...</p>
            ) : finstatData.zisk !== null ? (
              <>
                <p className={`text-3xl font-bold relative z-10 ${finstatData.zisk < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                  {formatEur(finstatData.zisk)}
                </p>
                {finstatData.trzby && <p className="text-xs text-slate-500 mt-1 relative z-10">Tržby: {formatEur(finstatData.trzby)}</p>}
              </>
            ) : (
              <p className="text-sm text-slate-500 mt-2 relative z-10">Nedostupné (SZČO/Chránené)</p>
            )}
          </div>
        </div>

        {/* CHART & HISTORY */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* BAR CHART */}
          <div className="lg:col-span-1 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h3 className="text-lg font-semibold mb-6">Príjmy po rokoch</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <XAxis dataKey="year" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={(val) => `€${(val/1000).toFixed(0)}k`} tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} width={60} />
                  <Tooltip 
                    formatter={(val: any) => formatEur(val as number)} 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} 
                    cursor={{ fill: '#f1f5f9' }}
                  />
                  <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* TRANSACTIONS */}
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-6 border-b border-slate-100">
              <h3 className="text-lg font-semibold">História všetkých zákaziek</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-4 font-medium">Predmet zákazky</th>
                    <th className="px-6 py-4 font-medium text-right">Suma</th>
                    <th className="px-6 py-4 font-medium">Zdroj a Dátum</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {transactions.map((t: any) => (
                    <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-medium text-slate-800 line-clamp-2" title={t.subject}>{t.subject}</p>
                        <p className="text-xs text-slate-500 mt-1">Odberateľ: {t.buyer?.name}</p>
                        {t.amount_eur >= 100000 && (
                          <div className="mt-2 inline-flex items-center gap-1 px-2 py-1 bg-amber-50 text-amber-700 text-xs font-semibold rounded border border-amber-100">
                            <AlertTriangle className="w-3 h-3" /> RPVS
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
                          <a href={t.source_url?.startsWith('http') ? t.source_url : `https://${t.source_url}`} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-xs font-medium mt-1">
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
      </main>
    </div>
  );
}
