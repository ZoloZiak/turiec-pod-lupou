"use client";

import { ShieldAlert, ArrowRight, XCircle, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import VerifiedBadge from "../components/VerifiedBadge";
import { createClient } from "@supabase/supabase-js";
import { useState, useEffect } from "react";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

export default function NkuPage() {
  const [nkuReports, setNkuReports] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      if (!supabase) {
        setLoading(false);
        return;
      }
      const { data, error } = await supabase
        .from('nku_reports')
        .select('*')
        .order('year', { ascending: false });
      if (!error && data) {
        setNkuReports(data);
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
          <h1 className="text-4xl font-extrabold flex items-center gap-3"><ShieldAlert className="w-10 h-10 text-red-400" aria-hidden="true" /> Kontroly NKÚ SR</h1>
          <p className="text-lg text-muted mt-4 max-w-2xl">Záznamy a protokoly z kontrol Najvyššieho kontrolného úradu na Mestskom úrade a v mestských podnikoch.</p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-12 space-y-6">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
          </div>
        ) : nkuReports.length === 0 ? (
          <div className="bg-card rounded-2xl shadow-sm border border-line p-12 text-center">
            <h3 className="text-xl font-bold text-body mb-2">Zatiaľ žiadne dáta</h3>
            <p className="text-muted">Čaká sa na prvé stiahnutie dát o kontrolách z NKÚ SR.</p>
          </div>
        ) : (
          nkuReports.map(r => (
            <div key={r.id} className="bg-card rounded-2xl shadow-sm border border-line p-6 flex flex-col md:flex-row gap-6 justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <span className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm font-bold ${r.penalty_eur > 0 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                    {r.penalty_eur > 0 ? <XCircle className="w-4 h-4" aria-hidden="true"/> : <CheckCircle2 className="w-4 h-4" aria-hidden="true"/>}
                    {r.status}
                  </span>
                  <span className="text-muted font-mono text-sm">Rok: {r.year}</span>
                </div>
                <h2 className="text-2xl font-bold text-body mb-2">{r.title}</h2>
                <p className="text-muted max-w-3xl">{r.description}</p>
                <a href={r.report_url} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline flex items-center gap-1 mt-4">Protokol o kontrole <ArrowRight className="w-3 h-3" aria-hidden="true"/></a>
              </div>
              
              {r.penalty_eur > 0 && (
                <div className="bg-red-50 dark:bg-red-950/40 p-4 rounded-xl border border-red-100 dark:border-red-900 text-right min-w-[200px]">
                  <p className="text-sm text-red-800 dark:text-red-300 font-medium mb-1">Udelená pokuta / Manká</p>
                  <div className="flex items-center justify-end">
                    <span className="text-3xl font-black text-red-600">{formatEur(r.penalty_eur)}</span>
                    <VerifiedBadge source="NKÚ SR" />
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </main>
    </div>
  );
}
