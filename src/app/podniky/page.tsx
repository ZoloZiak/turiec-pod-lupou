"use client";

import { Building2, TrendingDown, ArrowRight, Activity, Euro } from "lucide-react";
import Link from "next/link";
import VerifiedBadge from "../components/VerifiedBadge";

const podniky = [
  { name: "Dopravný podnik mesta Martin, s.r.o.", zisk: -1250000, dotacia: 4500000, type: "MHD", url: "https://finstat.sk/53528255" },
  { name: "Turiec a.s.", zisk: 12000, dotacia: 0, type: "Správa majetku", url: "https://finstat.sk/31636228" },
  { name: "Brantner Fatra s.r.o.", zisk: 345000, dotacia: 0, type: "Odpad", url: "https://finstat.sk/31590627" }
];

export default function PodnikyPage() {
  const formatEur = (amount: number) => new Intl.NumberFormat('sk-SK', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(amount);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20">
      <header className="bg-slate-900 text-white pt-16 pb-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <Link href="/" className="text-sm font-medium text-slate-400 hover:text-white mb-4 block">&larr; Dashboard</Link>
          <h1 className="text-4xl font-extrabold flex items-center gap-3"><Building2 className="w-10 h-10 text-emerald-400" /> Hospodárenie mestských podnikov</h1>
          <p className="text-lg text-slate-400 mt-4 max-w-2xl">Finančné zdravie firiem vlastnených alebo spoluvlastnených mestom.</p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-12 space-y-6">
        {podniky.map(p => (
          <div key={p.name} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col md:flex-row gap-6 justify-between items-center">
            <div>
              <span className="text-xs font-bold bg-slate-100 px-2 py-1 rounded text-slate-600 mb-2 inline-block">{p.type}</span>
              <h2 className="text-2xl font-bold text-slate-900">{p.name}</h2>
              <a href={p.url} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline flex items-center gap-1 mt-2">Zdroj dát: FinStat <ArrowRight className="w-3 h-3"/></a>
            </div>
            <div className="flex gap-8">
              <div className="text-right">
                <p className="text-sm text-slate-500 mb-1">Hospodársky výsledok (2023)</p>
                <p className={`text-2xl font-bold flex items-center gap-2 justify-end ${p.zisk < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                  {p.zisk < 0 ? <TrendingDown className="w-5 h-5"/> : <Activity className="w-5 h-5"/>}
                  {formatEur(p.zisk)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-slate-500 mb-1">Mestská dotácia</p>
                <div className="flex items-center justify-end">
                  <p className="text-2xl font-bold text-slate-800 bg-slate-100 px-2 rounded">{formatEur(p.dotacia)}</p>
                  {p.dotacia > 0 && <VerifiedBadge source="Záverečný účet Mesta Martin" />}
                </div>
              </div>
            </div>
          </div>
        ))}
      </main>
    </div>
  );
}
