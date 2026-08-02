"use client";

import { Globe, MapPin, Building, Calendar, ArrowRight } from "lucide-react";
import Link from "next/link";
import VerifiedBadge from "../components/VerifiedBadge";
import { createClient } from "@supabase/supabase-js";
import { useState, useEffect } from "react";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

export default function EurofondyPage() {
  const [dotacie, setDotacie] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      if (!supabase) {
        setLoading(false);
        return;
      }
      const { data, error } = await supabase
        .from('eu_funds')
        .select('*')
        .order('year', { ascending: false });
      if (!error && data) {
        setDotacie(data);
      }
      setLoading(false);
    }
    fetchData();
  }, []);
  const formatEur = (amount: number) => new Intl.NumberFormat('sk-SK', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(amount);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20">
      <header className="bg-slate-900 text-white pt-16 pb-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <Link href="/" className="text-sm font-medium text-slate-400 hover:text-white mb-4 block">&larr; Dashboard</Link>
          <h1 className="text-4xl font-extrabold flex items-center gap-3"><Globe className="w-10 h-10 text-blue-400" /> Eurofondy a Dotácie</h1>
          <p className="text-lg text-slate-400 mt-4 max-w-2xl">Prehľad externých grantov mesta (ITMS, Plán obnovy) a kto z nich reálne profitoval (víťazi tendrov).</p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-12 space-y-6">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : dotacie.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center">
            <h3 className="text-xl font-bold text-slate-800 mb-2">Zatiaľ žiadne dáta</h3>
            <p className="text-slate-500">Čaká sa na prvé stiahnutie dát z ITMS a Plánu obnovy.</p>
          </div>
        ) : (
          dotacie.map(d => (
            <div key={d.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col md:flex-row gap-6 justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-bold">{d.program_name}</span>
                  <span className="text-slate-400 font-mono text-sm flex items-center gap-1"><Calendar className="w-4 h-4"/> {d.year}</span>
                </div>
                <h2 className="text-2xl font-bold text-slate-900 mb-4">{d.project_name}</h2>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <p className="text-sm text-slate-500 mb-1">Kto zákazku realizoval (Víťaz obstarávania):</p>
                  <div className="flex items-center gap-2">
                    <Building className="w-5 h-5 text-slate-400"/>
                    {d.winner_ico ? (
                      <>
                        <Link href={`/dodavatel/${d.winner_ico}`} className="text-lg font-bold text-blue-600 hover:underline">{d.winner_name}</Link>
                        <span className="text-xs text-slate-400 font-mono ml-2">IČO: {d.winner_ico}</span>
                      </>
                    ) : (
                      <span className="text-lg font-bold text-slate-600">Neznáme IČO ({d.winner_name})</span>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 text-right min-w-[200px]">
                <p className="text-sm text-emerald-800 font-medium mb-1">Získaná dotácia</p>
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
