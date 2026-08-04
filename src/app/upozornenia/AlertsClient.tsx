"use client";

import { useState } from 'react';
import { Search, AlertTriangle, ShieldAlert, Calendar, FileText, CheckCircle, ExternalLink, Filter } from 'lucide-react';
import Link from 'next/link';
import RpvsBadge from '../components/RpvsBadge';

function formatEur(amount: number) {
  return new Intl.NumberFormat('sk-SK', { style: 'currency', currency: 'EUR' }).format(amount);
}

export default function AlertsClient({ over100k, missingCrz }: { over100k: any[], missingCrz: any[] }) {
  const [activeTab, setActiveTab] = useState<'100k' | 'crz'>('100k');
  const [searchTerm, setSearchTerm] = useState('');
  const [minAmount, setMinAmount] = useState<number>(0);

  // Filter 100k alerts
  const filteredOver100k = over100k.filter(alert => {
    if (minAmount > 0 && alert.amount_eur < minAmount) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchName = alert.supplier?.name?.toLowerCase().includes(term);
      const matchIco = alert.supplier?.ico?.includes(term);
      const matchSubject = alert.subject?.toLowerCase().includes(term);
      if (!matchName && !matchIco && !matchSubject) return false;
    }
    return true;
  });

  // Filter missing CRZ alerts
  const filteredMissingCrz = missingCrz.filter(alert => {
    if (minAmount > 0 && alert.amount_eur < minAmount) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchName = alert.supplier?.name?.toLowerCase().includes(term);
      const matchIco = alert.supplier?.ico?.includes(term);
      const matchSubject = alert.subject?.toLowerCase().includes(term);
      if (!matchName && !matchIco && !matchSubject) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* FILTER BAR FOR ALERTS */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-wrap items-center justify-between gap-4">
        <div className="flex-1 min-w-[240px] relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Hľadať firmu, IČO alebo predmet zákazky..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-slate-800 placeholder:text-slate-400"
          />
        </div>

        <div className="flex items-center gap-2 text-xs font-semibold">
          <span className="text-slate-500 uppercase tracking-widest text-[11px] flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Min. suma:
          </span>
          <button
            onClick={() => setMinAmount(0)}
            className={`px-3 py-1.5 rounded-lg border transition-all ${minAmount === 0 ? 'bg-slate-800 text-white border-slate-700' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}
          >
            Všetky sumy
          </button>
          <button
            onClick={() => setMinAmount(50000)}
            className={`px-3 py-1.5 rounded-lg border transition-all ${minAmount === 50000 ? 'bg-amber-600 text-white border-amber-500' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}
          >
            nad 50k €
          </button>
          <button
            onClick={() => setMinAmount(100000)}
            className={`px-3 py-1.5 rounded-lg border transition-all ${minAmount === 100000 ? 'bg-red-600 text-white border-red-500' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}
          >
            nad 100k €
          </button>
        </div>
      </div>

      {/* MOBILE TABS */}
      <div className="lg:hidden flex gap-2">
        <button
          onClick={() => setActiveTab('100k')}
          className={`flex-1 py-2.5 px-4 rounded-xl font-bold text-sm transition-all border ${activeTab === '100k' ? 'bg-amber-500 text-white border-amber-600 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
        >
          Zákazky nad 100k ({filteredOver100k.length})
        </button>
        <button
          onClick={() => setActiveTab('crz')}
          className={`flex-1 py-2.5 px-4 rounded-xl font-bold text-sm transition-all border ${activeTab === 'crz' ? 'bg-red-600 text-white border-red-700 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
        >
          Chýba zmluva ({filteredMissingCrz.length})
        </button>
      </div>

      {/* GRID LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* COLUMN 1: Zákazky nad 100 000 € */}
        <div className={`${activeTab === '100k' ? 'block' : 'hidden'} lg:block`}>
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden h-full flex flex-col">
            <div className="bg-amber-50 border-b border-amber-100 p-6 flex justify-between items-center">
              <div>
                <h2 className="text-lg font-bold text-amber-900 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                  Zákazky nad 100 000 € (Kontrola RPVS)
                </h2>
                <p className="text-xs text-amber-700 mt-1">
                  Zákazky od subjektov s faktúrou nad 100 000 €. Zákon prikazuje komerčným firmám zápis v RPVS.
                </p>
              </div>
              <span className="bg-amber-200/60 text-amber-900 text-xs font-bold px-2.5 py-1 rounded-full shrink-0">
                {filteredOver100k.length}
              </span>
            </div>
            
            <div className="divide-y divide-slate-100 flex-1 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 300px)' }}>
              {filteredOver100k.length === 0 ? (
                <div className="p-12 text-center text-slate-500">
                  Pre zadané kritériá sa nenašli žiadne zákazky.
                </div>
              ) : (
                filteredOver100k.map(alert => (
                  <div key={alert.id} className="p-6 hover:bg-slate-50 transition-colors">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <Link href={`/dodavatel/${alert.supplier?.ico}`} className="text-base font-bold text-blue-600 hover:underline">
                          {alert.supplier?.name}
                        </Link>
                        <p className="text-xs text-slate-500 mt-0.5 font-mono">IČO: {alert.supplier?.ico}</p>
                      </div>
                      <span className="font-bold text-slate-900 bg-slate-100 px-3 py-1 rounded-full text-sm font-mono border border-slate-200">
                        {formatEur(alert.amount_eur)}
                      </span>
                    </div>
                    <div className="text-sm text-slate-700 mb-4 line-clamp-2">
                      <span className="font-medium text-slate-500 mr-2">Predmet:</span>
                      {alert.subject || "Neuvedený predmet"}
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-4">
                      {alert.supplier?.ico ? (
                        <RpvsBadge ico={alert.supplier.ico} name={alert.supplier?.name} />
                      ) : (
                        <span className="text-xs text-slate-400 font-mono">Neznáme IČO</span>
                      )}
                      
                      <div className="flex items-center gap-4 text-slate-500 text-xs font-medium ml-auto">
                        <span className="flex items-center gap-1 font-mono">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" /> {new Date(alert.date_published).toLocaleDateString('sk-SK')}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* COLUMN 2: Faktúry bez CRZ */}
        <div className={`${activeTab === 'crz' ? 'block' : 'hidden'} lg:block`}>
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden h-full flex flex-col">
            <div className="bg-red-50 border-b border-red-100 p-6 flex justify-between items-center">
              <div>
                <h2 className="text-lg font-bold text-red-900 flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-red-500" />
                  Faktúry bez zmluvy v CRZ
                </h2>
                <p className="text-xs text-red-700 mt-1">
                  Dodávatelia, ktorí fakturujú mestu, ale v CRZ nebola nájdená žiadna zverejnená zmluva.
                </p>
              </div>
              <span className="bg-red-200/60 text-red-900 text-xs font-bold px-2.5 py-1 rounded-full shrink-0">
                {filteredMissingCrz.length}
              </span>
            </div>
            
            <div className="divide-y divide-slate-100 flex-1 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 300px)' }}>
              {filteredMissingCrz.length === 0 ? (
                <div className="p-12 text-center text-slate-500 flex flex-col items-center gap-2">
                  <CheckCircle className="w-8 h-8 text-emerald-500 mb-2" />
                  Pre zadané filtre neboli nájdené žiadne nezrovnalosti.
                </div>
              ) : (
                filteredMissingCrz.map(alert => (
                  <div key={alert.id} className="p-6 hover:bg-slate-50 transition-colors">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <Link href={`/dodavatel/${alert.supplier?.ico}`} className="text-base font-bold text-blue-600 hover:underline">
                          {alert.supplier?.name}
                        </Link>
                        <p className="text-xs text-slate-500 mt-0.5 font-mono">IČO: {alert.supplier?.ico}</p>
                      </div>
                      <span className="font-bold text-red-700 bg-red-100 px-3 py-1 rounded-full text-sm font-mono border border-red-200">
                        {formatEur(alert.amount_eur)}
                      </span>
                    </div>
                    
                    <div className="text-sm text-slate-700 mb-4 bg-slate-50 p-3 rounded-lg border border-slate-100">
                      <span className="font-medium text-slate-500 block mb-1">Fakturované za:</span>
                      {alert.subject || "Neuvedený predmet"}
                    </div>
                    
                    <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-4">
                      {alert.source_url ? (
                        <a 
                          href={alert.source_url?.startsWith('http') ? alert.source_url : `https://${alert.source_url}`} 
                          target="_blank" 
                          rel="noreferrer" 
                          className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:underline font-semibold bg-blue-50 px-2.5 py-1 rounded-md border border-blue-100"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          Otvoriť PDF faktúru <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : <div></div>}
                      
                      <div className="flex items-center gap-4 text-slate-500 text-xs font-medium ml-auto font-mono">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" /> {new Date(alert.date_published).toLocaleDateString('sk-SK')}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
