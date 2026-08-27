"use client";

import { Users, ThumbsUp, ThumbsDown, FileText } from "lucide-react";
import Link from "next/link";
import VerifiedBadge from "../components/VerifiedBadge";
import { createClient } from "@supabase/supabase-js";
import { useState, useEffect } from "react";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

export default function PoslanciPage() {
  const [hlasovania, setHlasovania] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      if (!supabase) {
        setLoading(false);
        return;
      }
      const { data, error } = await supabase
        .from('city_council_votes')
        .select('*')
        .order('vote_date', { ascending: false });
      if (!error && data) {
        setHlasovania(data);
      }
      setLoading(false);
    }
    fetchData();
  }, []);
  return (
    <div className="min-h-screen bg-surface text-body pb-20">
      <header className="bg-card text-body pt-16 pb-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <Link href="/" className="text-sm font-medium text-muted hover:text-body mb-4 block">&larr; Dashboard</Link>
          <h1 className="text-4xl font-extrabold flex items-center gap-3"><Users className="w-10 h-10 text-purple-400" aria-hidden="true" /> Ako hlasovali poslanci</h1>
          <p className="text-lg text-muted mt-4 max-w-2xl">Záznamy z mestského zastupiteľstva – kontrolujte, ako vaši volení zástupcovia hlasovali pri kľúčových kauzách.</p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-12 space-y-6">
        <div className="bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900 p-4 rounded-xl flex items-center justify-between mb-8">
           <div className="flex items-center gap-3">
             <FileText className="w-5 h-5 text-purple-600" aria-hidden="true"/>
             <span className="font-bold text-purple-900 dark:text-purple-200">Vyberte kauzu zo zoznamu (čoskoro)</span>
           </div>
           <VerifiedBadge source="Záznam zo zastupiteľstva" />
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          </div>
        ) : hlasovania.length === 0 ? (
          <div className="bg-card rounded-2xl shadow-sm border border-line p-12 text-center">
            <h3 className="text-xl font-bold text-body mb-2">Zatiaľ žiadne dáta</h3>
            <p className="text-muted">Čaká sa na stiahnutie a vyhodnotenie prvých hlasovaní z MsZ.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {hlasovania.map(h => (
              <div key={h.id} className="bg-card rounded-2xl shadow-sm border border-line p-6 flex flex-col justify-between items-center text-center">
                <div className="w-16 h-16 bg-elevated rounded-full mb-4 flex items-center justify-center">
                  <Users className="w-8 h-8 text-muted" aria-hidden="true"/>
                </div>
                <h3 className="text-xl font-bold text-body mb-1">{h.councillor_name}</h3>
                <p className="text-muted mb-6">Volebný obvod: {h.district}</p>
                
                <div className={`w-full py-3 rounded-xl font-black text-lg flex items-center justify-center gap-2 ${
                  h.vote_cast === 'ZA' ? 'bg-emerald-100 text-emerald-700' :
                  h.vote_cast === 'PROTI' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  {h.vote_cast === 'ZA' && <ThumbsUp className="w-5 h-5" aria-hidden="true" />}
                  {h.vote_cast === 'PROTI' && <ThumbsDown className="w-5 h-5" aria-hidden="true" />}
                  Hlasoval: {h.vote_cast}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
