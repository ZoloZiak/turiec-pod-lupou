"use client";

import { Users, ThumbsUp, ThumbsDown, Filter, FileText } from "lucide-react";
import Link from "next/link";
import VerifiedBadge from "../components/VerifiedBadge";

const hlasovania = [
  { id: "1", meno: "Ing. Ján Kováč", obvod: "Stred", hlasoval: "ZA", kauza: "Spoplatnenie parkovania v centre mesta", date: "15.03.2024" },
  { id: "2", meno: "MUDr. Peter Novák", obvod: "Priekopa", hlasoval: "PROTI", kauza: "Spoplatnenie parkovania v centre mesta", date: "15.03.2024" },
  { id: "3", meno: "Mgr. Lucia Kováčová", obvod: "Záturčie", hlasoval: "ZDRŽAL SA", kauza: "Spoplatnenie parkovania v centre mesta", date: "15.03.2024" },
];

export default function PoslanciPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20">
      <header className="bg-slate-900 text-white pt-16 pb-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <Link href="/" className="text-sm font-medium text-slate-400 hover:text-white mb-4 block">&larr; Dashboard</Link>
          <h1 className="text-4xl font-extrabold flex items-center gap-3"><Users className="w-10 h-10 text-purple-400" /> Ako hlasovali poslanci</h1>
          <p className="text-lg text-slate-400 mt-4 max-w-2xl">Záznamy z mestského zastupiteľstva – kontrolujte, ako vaši volení zástupcovia hlasovali pri kľúčových kauzách.</p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-12 space-y-6">
        <div className="bg-purple-50 border border-purple-200 p-4 rounded-xl flex items-center justify-between mb-8">
           <div className="flex items-center gap-3">
             <FileText className="w-5 h-5 text-purple-600"/>
             <span className="font-bold text-purple-900">Aktuálna kauza: Spoplatnenie parkovania v centre mesta</span>
           </div>
           <VerifiedBadge source="Záznam zo zastupiteľstva" date="15.03.2024"/>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {hlasovania.map(h => (
            <div key={h.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col justify-between items-center text-center">
              <div className="w-16 h-16 bg-slate-100 rounded-full mb-4 flex items-center justify-center">
                <Users className="w-8 h-8 text-slate-400"/>
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-1">{h.meno}</h3>
              <p className="text-slate-500 mb-6">Volebný obvod: {h.obvod}</p>
              
              <div className={`w-full py-3 rounded-xl font-black text-lg flex items-center justify-center gap-2 ${
                h.hlasoval === 'ZA' ? 'bg-emerald-100 text-emerald-700' :
                h.hlasoval === 'PROTI' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
              }`}>
                {h.hlasoval === 'ZA' && <ThumbsUp className="w-5 h-5" />}
                {h.hlasoval === 'PROTI' && <ThumbsDown className="w-5 h-5" />}
                Hlasoval: {h.hlasoval}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
