"use client";

import { Building2, Search, ArrowRight, TrendingUp, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { useState, useEffect } from "react";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
// Safe initialization for Next.js build time
const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

export default function MajetkyPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [assets, setAssets] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      if (!supabase) {
        setLoading(false);
        return;
      }
      
      const { data, error } = await supabase
        .from('asset_declarations')
        .select('*')
        .order('year', { ascending: false });
        
      if (!error && data) {
        setAssets(data);
      }
      setLoading(false);
    }
    fetchData();
  }, []);

  const formatEur = (amount: number) => {
    return new Intl.NumberFormat('sk-SK', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(amount);
  };

  return (
    <div className="min-h-screen bg-surface text-body font-sans pb-20">
      
      {/* HEADER */}
      <header className="bg-card text-body pt-16 pb-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-4">
            <Link href="/" className="text-sm font-medium text-muted hover:text-body transition-colors">
              &larr; Späť na Dashboard
            </Link>
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4 flex items-center gap-3">
            <Building2 className="w-10 h-10 text-emerald-400" aria-hidden="true" />
            Majetkové priznania
          </h1>
          <p className="text-lg text-muted max-w-2xl leading-relaxed">
            Transparentný prehľad oficiálnych príjmov a deklarovaného majetku verejných funkcionárov mesta Martin a riaditeľov mestských podnikov.
          </p>
        </div>
      </header>

      {/* CONTENT */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-12">
        
        {/* SEARCH & FILTERS */}
        <div className="bg-card rounded-2xl shadow-lg border border-line p-4 flex flex-col md:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted w-5 h-5" aria-hidden="true" />
            <input 
              type="text" 
              aria-label="Vyhľadať funkcionára"
              placeholder="Vyhľadať funkcionára (napr. Ján Danko)..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-surface border border-line rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-card transition-all text-body"
            />
          </div>
        </div>

        {/* ALERTS */}
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl p-4 flex gap-3 items-start mb-8">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-sm text-amber-800">
            <strong>Modul sa pripravuje:</strong> Tento modul zatiaľ neobsahuje overené majetkové priznania. Pracujeme na napojení na oficiálny zdroj (napr. zverejnené priznania funkcionárov mesta Martin). Kým nebude zdroj overený, žiadne údaje o majetku tu nezverejňujeme.
          </p>
        </div>

        {/* LIST OF DECLARATIONS */}
        <div className="space-y-6">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
            </div>
          ) : assets.length === 0 ? (
            <div className="bg-card rounded-2xl shadow-sm border border-line p-10 text-center">
              <Building2 className="w-12 h-12 text-body mx-auto mb-4" aria-hidden="true" />
              <h2 className="text-xl font-semibold text-body mb-2">Zatiaľ žiadne overené priznania</h2>
              <p className="text-muted max-w-lg mx-auto leading-relaxed">
                V tomto module momentálne nezobrazujeme žiadne majetkové priznania. Údaje doplníme až po overení voči oficiálnemu zdroju. Neuvádzame neoverené ani odhadované čísla.
              </p>
            </div>
          ) : (
            assets
              .filter(a => a.person_name.toLowerCase().includes(searchTerm.toLowerCase()))
              .map((asset) => (
            <div key={asset.id} className="bg-card rounded-2xl shadow-sm border border-line p-6 flex flex-col md:flex-row gap-6 items-start">
              
              <div className="md:w-1/3">
                <div className="flex items-center gap-2 mb-2">
                  <h2 className="text-2xl font-bold text-body">{asset.person_name}</h2>
                </div>
                <p className="text-muted font-medium">{asset.role}</p>
                <div className="mt-4 bg-surface p-4 rounded-xl border border-line">
                  <p className="text-sm text-muted mb-1">Oficiálny ročný príjem (Mesto)</p>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold text-body">{formatEur(asset.official_salary_eur)}</span>
                    <span className="text-xs text-muted">{`Za rok ${asset.year}`}</span>
                  </div>
                </div>
              </div>

              <div className="md:w-2/3 md:border-l border-line md:pl-6 w-full">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-body flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-emerald-500" aria-hidden="true" />
                    Priznaný majetok ({asset.year})
                  </h3>
                  <a href={asset.source_url} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                    Zdrojový dokument <ArrowRight className="w-3 h-3" aria-hidden="true" />
                  </a>
                </div>
                
                <div className="bg-card border border-line rounded-xl p-5 shadow-inner">
                  <ul className="space-y-3">
                    {asset.declared_assets.split(', ').map((item: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-body">
                        <span className="text-emerald-500 font-bold mt-0.5">•</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
                
                <div className="mt-4 flex items-center gap-2 text-sm text-muted">
                  <AlertTriangle className="w-4 h-4 text-amber-500" aria-hidden="true" />
                  Analýza odchýlky majetku voči príjmu zatiaľ nie je k dispozícii pre tento rok.
                </div>
              </div>
              
            </div>
          )))}
        </div>
        
      </main>
    </div>
  );
}
