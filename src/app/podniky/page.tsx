"use client";

import { Building2, TrendingDown, ArrowRight, Activity, ArrowRightLeft } from "lucide-react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { useState, useEffect } from "react";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

export default function PodnikyPage() {
  const [podniky, setPodniky] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Interactive Comparison Mode (Bliźniak)
  const [compAId, setCompAId] = useState<string>("");
  const [compBId, setCompBId] = useState<string>("");

  useEffect(() => {
    async function fetchData() {
      if (!supabase) {
        setLoading(false);
        return;
      }
      const { data, error } = await supabase
        .from('city_companies')
        .select('*')
        .order('name');
      if (!error && data) {
        setPodniky(data);
        if (data.length >= 2) {
          setCompAId(data[0].id);
          setCompBId(data[1].id);
        }
      }
      setLoading(false);
    }
    fetchData();
  }, []);

  const formatEur = (amount: number) => new Intl.NumberFormat('sk-SK', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(amount);

  const compA = podniky.find(p => p.id === compAId);
  const compB = podniky.find(p => p.id === compBId);

  return (
    <div className="min-h-screen bg-surface text-body pb-20 font-sans">
      <header className="bg-card border-b border-line text-body pt-12 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <Link href="/" className="text-sm font-medium text-muted hover:text-body mb-4 block">&larr; Dashboard</Link>
          <h1 className="text-4xl font-extrabold flex items-center gap-3">
            <Building2 className="w-10 h-10 text-emerald-400" aria-hidden="true" /> Hospodárenie mestských podnikov
          </h1>
          <p className="text-lg text-muted mt-4 max-w-2xl">
            Finančné zdravie firiem vlastnených alebo spoluvlastnených mestom Martin. Integrácia z FinStat API & RÚZ.
          </p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-10 space-y-10">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
          </div>
        ) : podniky.length === 0 ? (
          <div className="bg-card rounded-2xl shadow-sm border border-line p-12 text-center">
            <h3 className="text-xl font-bold text-body mb-2">Zatiaľ žiadne dáta</h3>
            <p className="text-muted">Čaká sa na prvé spustenie Krtka a stiahnutie dát z Finstatu.</p>
          </div>
        ) : (
          <>
            {/* POROVNÁVAČ PODNIKOV (Bliźniak z-dykty) */}
            <div className="bg-card rounded-2xl p-6 border border-line shadow-xl">
              <div className="flex items-center gap-2 mb-6">
                <ArrowRightLeft className="w-5 h-5 text-emerald-400" aria-hidden="true" />
                <h2 className="text-xl font-bold text-body tracking-wide">Porovnávač dvoch podnikov</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div>
                  <label className="block text-xs font-bold text-muted uppercase mb-2">Podnik A</label>
                  <select 
                    value={compAId} 
                    onChange={e => setCompAId(e.target.value)}
                    aria-label="Vybrať podnik A na porovnanie"
                    className="w-full bg-elevated border border-line text-body rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-emerald-500"
                  >
                    {podniky.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-muted uppercase mb-2">Podnik B</label>
                  <select 
                    value={compBId} 
                    onChange={e => setCompBId(e.target.value)}
                    aria-label="Vybrať podnik B na porovnanie"
                    className="w-full bg-elevated border border-line text-body rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-emerald-500"
                  >
                    {podniky.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {compA && compB && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-surface/60 p-6 rounded-xl border border-line">
                  {/* COMP A */}
                  <div className="space-y-4 border-b md:border-b-0 md:border-r border-line pb-6 md:pb-0 md:pr-6">
                    <h3 className="text-xl font-extrabold text-emerald-400">{compA.name}</h3>
                    <div className="flex justify-between items-center bg-card p-3 rounded-lg border border-line">
                      <span className="text-xs text-muted">Hospodársky výsledok ({compA.year})</span>
                      <span className={`font-bold font-mono ${compA.profit_loss_eur < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                        {formatEur(compA.profit_loss_eur)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center bg-card p-3 rounded-lg border border-line">
                      <span className="text-xs text-muted">Mestská dotácia</span>
                      <span className="font-bold font-mono text-body">{formatEur(compA.city_subsidy_eur)}</span>
                    </div>
                    <div className="pt-2">
                      <Link href={`/dodavatel/${compA.ico}`} className="text-xs font-semibold text-emerald-400 hover:underline flex items-center gap-1">
                        Zobraziť detail a zmluvy &rarr;
                      </Link>
                    </div>
                  </div>

                  {/* COMP B */}
                  <div className="space-y-4">
                    <h3 className="text-xl font-extrabold text-blue-400">{compB.name}</h3>
                    <div className="flex justify-between items-center bg-card p-3 rounded-lg border border-line">
                      <span className="text-xs text-muted">Hospodársky výsledok ({compB.year})</span>
                      <span className={`font-bold font-mono ${compB.profit_loss_eur < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                        {formatEur(compB.profit_loss_eur)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center bg-card p-3 rounded-lg border border-line">
                      <span className="text-xs text-muted">Mestská dotácia</span>
                      <span className="font-bold font-mono text-body">{formatEur(compB.city_subsidy_eur)}</span>
                    </div>
                    <div className="pt-2">
                      <Link href={`/dodavatel/${compB.ico}`} className="text-xs font-semibold text-blue-400 hover:underline flex items-center gap-1">
                        Zobraziť detail a zmluvy &rarr;
                      </Link>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* LIST OF ALL MUNICIPAL COMPANIES */}
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-muted uppercase tracking-wider">Všetky mestské podniky ({podniky.length})</h2>
              {podniky.map(p => (
                <div key={p.id} className="bg-card rounded-2xl shadow-lg border border-line p-6 flex flex-col md:flex-row gap-6 justify-between items-center hover:border-line transition-colors">
                  <div>
                    <span className="text-xs font-bold bg-elevated text-emerald-400 border border-line px-2.5 py-1 rounded mb-2 inline-block">{p.type}</span>
                    <h2 className="text-2xl font-bold text-body">{p.name}</h2>
                    <div className="flex gap-4 mt-2">
                      {p.finstat_url && (
                        <a href={p.finstat_url} target="_blank" rel="noreferrer" className="text-xs text-muted hover:text-emerald-400 flex items-center gap-1">
                          FinStat <ArrowRight className="w-3 h-3" aria-hidden="true"/>
                        </a>
                      )}
                      <Link href={`/dodavatel/${p.ico}`} className="text-xs text-emerald-400 hover:underline font-semibold">
                        Profil v Turiec pod Lupou &rarr;
                      </Link>
                    </div>
                  </div>
                  <div className="flex gap-8">
                    <div className="text-right">
                      <p className="text-xs text-muted mb-1">Hospodársky výsledok ({p.year})</p>
                      <p className={`text-2xl font-bold flex items-center gap-2 justify-end font-mono ${p.profit_loss_eur < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                        {p.profit_loss_eur < 0 ? <TrendingDown className="w-5 h-5" aria-hidden="true"/> : <Activity className="w-5 h-5" aria-hidden="true"/>}
                        {formatEur(p.profit_loss_eur)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted mb-1">Mestská dotácia</p>
                      <div className="flex items-center justify-end">
                        <p className="text-2xl font-bold text-body font-mono bg-elevated px-2 py-0.5 rounded border border-line">{formatEur(p.city_subsidy_eur)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
