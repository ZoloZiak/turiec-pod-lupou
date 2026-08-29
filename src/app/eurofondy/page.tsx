"use client";

import { Globe, Building, Calendar } from "lucide-react";
import Link from "next/link";
import VerifiedBadge from "../components/VerifiedBadge";
import { useState, useEffect } from "react";

export default function EurofondyPage() {
  const [dotacie, setDotacie] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/dataset?table=eu_funds');
        const json = await res.json();
        if (json.success) setDotacie(json.rows);
      } catch {
        // necháme prázdny stav
      }
      setLoading(false);
    }
    fetchData();
  }, []);
  const formatEur = (amount: number) => new Intl.NumberFormat('sk-SK', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(amount);

  return (
    <div className="min-h-screen bg-surface text-body pb-20">
      <header className="bg-card text-body pt-16 pb-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <Link href="/" className="text-sm font-medium text-muted hover:text-body mb-4 block">&larr; Dashboard</Link>
          <h1 className="text-4xl font-extrabold flex items-center gap-3"><Globe className="w-10 h-10 text-blue-400" aria-hidden="true" /> Eurofondy a Dotácie</h1>
          <p className="text-lg text-muted mt-4 max-w-2xl">Prehľad nenávratných finančných príspevkov (NFP), ktoré získalo mesto Martin a jeho podniky z eurofondov a národných programov (IROP, Program Slovensko, Interreg, Plán obnovy).</p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-12 space-y-6">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : dotacie.length === 0 ? (
          <div className="bg-card rounded-2xl shadow-sm border border-line p-12 text-center">
            <h3 className="text-xl font-bold text-body mb-2">Zatiaľ žiadne dáta</h3>
            <p className="text-muted">Čaká sa na prvé stiahnutie dát z ITMS a Plánu obnovy.</p>
          </div>
        ) : (
          dotacie.map(d => (
            <div key={d.id} className="bg-card rounded-2xl shadow-sm border border-line p-6 flex flex-col md:flex-row gap-6 justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-bold">{d.program_name ? String(d.program_name) : 'Eurofondy / dotácia'}</span>
                  <span className="text-muted font-mono text-sm flex items-center gap-1"><Calendar className="w-4 h-4" aria-hidden="true"/> {d.year}</span>
                </div>
                <h2 className="text-2xl font-bold text-body mb-4">{d.project_name}</h2>
                <div className="bg-surface p-4 rounded-xl border border-line">
                  <p className="text-sm text-muted mb-1">Prijímateľ dotácie:</p>
                  <div className="flex items-center gap-2">
                    <Building className="w-5 h-5 text-muted" aria-hidden="true"/>
                    {d.winner_ico ? (
                      <>
                        <Link href={`/dodavatel/${d.winner_ico}`} className="text-lg font-bold text-blue-600 hover:underline">{d.winner_name}</Link>
                        <span className="text-xs text-muted font-mono ml-2">IČO: {d.winner_ico}</span>
                      </>
                    ) : (
                      <span className="text-lg font-bold text-muted">Neznáme IČO ({d.winner_name})</span>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="bg-emerald-50 dark:bg-emerald-950/40 p-4 rounded-xl border border-emerald-100 dark:border-emerald-900 text-right min-w-[200px]">
                <p className="text-sm text-emerald-800 dark:text-emerald-300 font-medium mb-1">Získaná dotácia</p>
                <div className="flex items-center justify-end">
                  <span className="text-3xl font-black text-emerald-600">{formatEur(d.amount_eur)}</span>
                  <VerifiedBadge source="ITMS" />
                </div>
              </div>
            </div>
          ))
        )}
      </main>
    </div>
  );
}
