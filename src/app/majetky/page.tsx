"use client";

import { Building2, Search, ArrowRight, ShieldCheck, TrendingUp, AlertTriangle } from "lucide-react";
import Link from "next/link";
import VerifiedBadge from "../components/VerifiedBadge";
import { useState } from "react";

// Mockované dáta (kým používateľ nespustí SQL skript v Supabase)
const mockAssets = [
  {
    id: "1",
    person_name: "Ján Danko",
    role: "Primátor Mesta Martin",
    year: 2023,
    official_salary_eur: 76200,
    declared_assets: "Byt v Martine, 2x Garáž, Auto VW Touareg, Úspory 45 000 €",
    source_url: "https://www.nrsr.sk/web/"
  },
  {
    id: "2",
    person_name: "Ján Danko",
    role: "Primátor Mesta Martin",
    year: 2022,
    official_salary_eur: 74100,
    declared_assets: "Byt v Martine, 2x Garáž, Auto VW Touareg, Úspory 32 000 €",
    source_url: "https://www.nrsr.sk/web/"
  }
];

export default function MajetkyPage() {
  const [searchTerm, setSearchTerm] = useState("");

  const formatEur = (amount: number) => {
    return new Intl.NumberFormat('sk-SK', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(amount);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-20">
      
      {/* HEADER */}
      <header className="bg-slate-900 text-white pt-16 pb-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-4">
            <Link href="/" className="text-sm font-medium text-slate-400 hover:text-white transition-colors">
              &larr; Späť na Dashboard
            </Link>
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4 flex items-center gap-3">
            <Building2 className="w-10 h-10 text-emerald-400" />
            Majetkové priznania
          </h1>
          <p className="text-lg text-slate-400 max-w-2xl leading-relaxed">
            Transparentný prehľad oficiálnych príjmov a deklarovaného majetku verejných funkcionárov mesta Martin a riaditeľov mestských podnikov.
          </p>
        </div>
      </header>

      {/* CONTENT */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-12">
        
        {/* SEARCH & FILTERS */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-4 flex flex-col md:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input 
              type="text" 
              placeholder="Vyhľadať funkcionára (napr. Ján Danko)..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all text-slate-800"
            />
          </div>
        </div>

        {/* ALERTS */}
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex gap-3 items-start mb-8">
          <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <p className="text-sm text-emerald-800">
            <strong>Certifikát dát:</strong> Všetky údaje na tejto stránke pochádzajú z oficiálnych majetkových priznaní zverejnených na NRSR alebo stránkach mesta Martin. Majetok je uvádzaný presne v znení, ako ho funkcionár priznal.
          </p>
        </div>

        {/* LIST OF DECLARATIONS */}
        <div className="space-y-6">
          {mockAssets
            .filter(a => a.person_name.toLowerCase().includes(searchTerm.toLowerCase()))
            .map((asset) => (
            <div key={asset.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col md:flex-row gap-6 items-start">
              
              <div className="md:w-1/3">
                <div className="flex items-center gap-2 mb-2">
                  <h2 className="text-2xl font-bold text-slate-900">{asset.person_name}</h2>
                </div>
                <p className="text-slate-500 font-medium">{asset.role}</p>
                <div className="mt-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <p className="text-sm text-slate-500 mb-1">Oficiálny ročný príjem (Mesto)</p>
                  <div className="flex items-center">
                    <span className="text-2xl font-bold text-slate-800">{formatEur(asset.official_salary_eur)}</span>
                    <VerifiedBadge source="NRSR" date={`Za rok ${asset.year}`} />
                  </div>
                </div>
              </div>

              <div className="md:w-2/3 md:border-l border-slate-100 md:pl-6 w-full">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-emerald-500" />
                    Priznaný majetok ({asset.year})
                  </h3>
                  <a href={asset.source_url} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                    Zdrojový dokument <ArrowRight className="w-3 h-3" />
                  </a>
                </div>
                
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-inner">
                  <ul className="space-y-3">
                    {asset.declared_assets.split(', ').map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-slate-700">
                        <span className="text-emerald-500 font-bold mt-0.5">•</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
                
                <div className="mt-4 flex items-center gap-2 text-sm text-slate-500">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  Analýza odchýlky majetku voči príjmu zatiaľ nie je k dispozícii pre tento rok.
                </div>
              </div>
              
            </div>
          ))}
        </div>
        
      </main>
    </div>
  );
}
