"use client";

import { ShieldAlert, FileText, ArrowRight, XCircle, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import VerifiedBadge from "../components/VerifiedBadge";

const nkuReports = [
  { id: "1", title: "Hospodárenie s majetkom a finančnými prostriedkami", status: "Zistené porušenia", description: "NKÚ zistil nehospodárne nakladanie pri nákupe externých právnych služieb a nedostatky vo verejnom obstarávaní.", pokuta: 15000, rok: 2021, link: "https://www.nku.gov.sk/" },
  { id: "2", title: "Kontrola prideľovania nájomných bytov", status: "Bez nálezov", description: "Systém prideľovania nájomných bytov prebiehal podľa stanovených VZN mesta.", pokuta: 0, rok: 2019, link: "https://www.nku.gov.sk/" }
];

export default function NkuPage() {
  const formatEur = (amount: number) => new Intl.NumberFormat('sk-SK', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(amount);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20">
      <header className="bg-slate-900 text-white pt-16 pb-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <Link href="/" className="text-sm font-medium text-slate-400 hover:text-white mb-4 block">&larr; Dashboard</Link>
          <h1 className="text-4xl font-extrabold flex items-center gap-3"><ShieldAlert className="w-10 h-10 text-red-400" /> Kontroly NKÚ SR</h1>
          <p className="text-lg text-slate-400 mt-4 max-w-2xl">Záznamy a protokoly z kontrol Najvyššieho kontrolného úradu na Mestskom úrade a v mestských podnikoch.</p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-12 space-y-6">
        {nkuReports.map(r => (
          <div key={r.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col md:flex-row gap-6 justify-between items-start">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <span className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm font-bold ${r.pokuta > 0 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                  {r.pokuta > 0 ? <XCircle className="w-4 h-4"/> : <CheckCircle2 className="w-4 h-4"/>}
                  {r.status}
                </span>
                <span className="text-slate-400 font-mono text-sm">Rok: {r.rok}</span>
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">{r.title}</h2>
              <p className="text-slate-600 max-w-3xl">{r.description}</p>
              <a href={r.link} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline flex items-center gap-1 mt-4">Protokol o kontrole <ArrowRight className="w-3 h-3"/></a>
            </div>
            
            {r.pokuta > 0 && (
              <div className="bg-red-50 p-4 rounded-xl border border-red-100 text-right min-w-[200px]">
                <p className="text-sm text-red-800 font-medium mb-1">Udelená pokuta / Manká</p>
                <div className="flex items-center justify-end">
                  <span className="text-3xl font-black text-red-600">{formatEur(r.pokuta)}</span>
                  <VerifiedBadge source="NKÚ SR" />
                </div>
              </div>
            )}
          </div>
        ))}
      </main>
    </div>
  );
}
