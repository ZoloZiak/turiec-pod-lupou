"use client";

import { useState } from 'react';
import { Search, AlertTriangle, ShieldAlert, Calendar, FileText, CheckCircle, ExternalLink, Filter, ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import RpvsBadge from '../components/RpvsBadge';

interface Alert {
  id: string;
  amount_eur?: number;
  subject?: string;
  source_url?: string;
  date_published?: string;
  supplier?: { name?: string; ico?: string };
}

function formatEur(amount: number) {
  return new Intl.NumberFormat('sk-SK', { style: 'currency', currency: 'EUR' }).format(amount);
}

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? '—' : date.toLocaleDateString('sk-SK');
}

export default function AlertsClient({ over100k, missingCrz }: { over100k: Alert[], missingCrz: Alert[] }) {
  const [activeTab, setActiveTab] = useState<'100k' | 'crz'>('100k');
  const [searchTerm, setSearchTerm] = useState('');
  const [minAmount, setMinAmount] = useState<number>(0);
  
  // Stránkovanie pre 100k zmluvy
  const [page100k, setPage100k] = useState(1);
  // Stránkovanie pre chýbajúce CRZ
  const [pageCrz, setPageCrz] = useState(1);

  const ITEMS_PER_PAGE = 15;

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

  // Paginated Slices
  const paginatedOver100k = filteredOver100k.slice((page100k - 1) * ITEMS_PER_PAGE, page100k * ITEMS_PER_PAGE);
  const totalPages100k = Math.ceil(filteredOver100k.length / ITEMS_PER_PAGE);

  const paginatedMissingCrz = filteredMissingCrz.slice((pageCrz - 1) * ITEMS_PER_PAGE, pageCrz * ITEMS_PER_PAGE);
  const totalPagesCrz = Math.ceil(filteredMissingCrz.length / ITEMS_PER_PAGE);

  return (
    <div className="space-y-6">
      {/* FILTER BAR FOR ALERTS */}
      <div className="bg-card p-4 rounded-2xl shadow-sm border border-line flex flex-wrap items-center justify-between gap-4">
        <div className="flex-1 min-w-[240px] relative">
          <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
          <input
            type="text"
            aria-label="Hľadať firmu, IČO alebo predmet zákazky"
            placeholder="Hľadať firmu, IČO alebo predmet zákazky..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage100k(1);
              setPageCrz(1);
            }}
            className="w-full pl-9 pr-4 py-2 text-sm bg-surface border border-line rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-body placeholder:text-muted"
          />
        </div>

        <div className="flex items-center gap-2 text-xs font-semibold">
          <span className="text-muted uppercase tracking-widest text-[11px] flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" aria-hidden="true" /> Min. suma:
          </span>
          <button
            onClick={() => { setMinAmount(0); setPage100k(1); setPageCrz(1); }}
            className={`px-3 py-1.5 rounded-lg border transition-all ${minAmount === 0 ? 'bg-elevated text-body border-line' : 'bg-surface text-muted border-line hover:bg-elevated'}`}
          >
            Všetky sumy
          </button>
          <button
            onClick={() => { setMinAmount(50000); setPage100k(1); setPageCrz(1); }}
            className={`px-3 py-1.5 rounded-lg border transition-all ${minAmount === 50000 ? 'bg-amber-600 text-white border-amber-500' : 'bg-surface text-muted border-line hover:bg-elevated'}`}
          >
            nad 50k €
          </button>
          <button
            onClick={() => { setMinAmount(100000); setPage100k(1); setPageCrz(1); }}
            className={`px-3 py-1.5 rounded-lg border transition-all ${minAmount === 100000 ? 'bg-red-600 text-white border-red-500' : 'bg-surface text-muted border-line hover:bg-elevated'}`}
          >
            nad 100k €
          </button>
        </div>
      </div>

      {/* MOBILE TABS */}
      <div className="lg:hidden flex gap-2">
        <button
          onClick={() => setActiveTab('100k')}
          className={`flex-1 py-2.5 px-4 rounded-xl font-bold text-sm transition-all border ${activeTab === '100k' ? 'bg-amber-500 text-white border-amber-600 shadow-sm' : 'bg-card text-muted border-line hover:bg-surface'}`}
        >
          Zákazky nad 100k ({filteredOver100k.length})
        </button>
        <button
          onClick={() => setActiveTab('crz')}
          className={`flex-1 py-2.5 px-4 rounded-xl font-bold text-sm transition-all border ${activeTab === 'crz' ? 'bg-red-600 text-white border-red-700 shadow-sm' : 'bg-card text-muted border-line hover:bg-surface'}`}
        >
          Chýba zmluva ({filteredMissingCrz.length})
        </button>
      </div>

      {/* GRID LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* COLUMN 1: Zákazky nad 100 000 € */}
        <div className={`${activeTab === '100k' ? 'block' : 'hidden'} lg:block`}>
          <div className="bg-card rounded-2xl shadow-sm border border-line overflow-hidden flex flex-col">
            <div className="bg-amber-50 dark:bg-amber-950/40 border-b border-amber-100 dark:border-amber-900 p-6 flex justify-between items-center">
              <div>
                <h2 className="text-lg font-bold text-amber-900 dark:text-amber-200 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-500" aria-hidden="true" />
                  Zákazky nad 100 000 € (Kontrola RPVS)
                </h2>
                <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                  Zákazky od subjektov s faktúrou nad 100 000 €. Zákon prikazuje komerčným firmám zápis v RPVS.
                </p>
              </div>
              <span className="bg-amber-200/60 text-amber-900 text-xs font-bold px-2.5 py-1 rounded-full shrink-0">
                {filteredOver100k.length}
              </span>
            </div>
            
            <div className="divide-y divide-line">
              {paginatedOver100k.length === 0 ? (
                <div className="p-12 text-center text-muted">
                  Pre zadané kritériá sa nenašli žiadne zákazky.
                </div>
              ) : (
                paginatedOver100k.map(alert => (
                  <div key={alert.id} className="p-6 hover:bg-surface transition-colors">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <Link href={`/dodavatel/${alert.supplier?.ico}`} className="text-base font-bold text-blue-600 hover:underline">
                          {alert.supplier?.name || "Neznámy dodávateľ"}
                        </Link>
                        <p className="text-xs text-muted mt-0.5 font-mono">IČO: {alert.supplier?.ico || "Neznáme"}</p>
                      </div>
                      <span className="font-bold text-body bg-elevated px-3 py-1 rounded-full text-sm font-mono border border-line">
                        {formatEur(alert.amount_eur || 0)}
                      </span>
                    </div>
                    <div className="text-sm text-body mb-4 line-clamp-2">
                      <span className="font-medium text-muted mr-2">Predmet:</span>
                      {alert.subject || "Neuvedený predmet"}
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line pt-4">
                      {alert.supplier?.ico ? (
                        <RpvsBadge ico={alert.supplier.ico} name={alert.supplier?.name} />
                      ) : (
                        <span className="text-xs text-muted font-mono">Neznáme IČO</span>
                      )}
                      
                      <div className="flex items-center gap-4 text-muted text-xs font-medium ml-auto">
                        <span className="flex items-center gap-1 font-mono">
                          <Calendar className="w-3.5 h-3.5 text-muted" aria-hidden="true" /> {formatDate(alert.date_published)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Pagination Controls 100k */}
            {totalPages100k > 1 && (
              <div className="p-4 border-t border-line bg-surface flex items-center justify-between">
                <span className="text-xs text-muted">
                  Strana {page100k} z {totalPages100k}
                </span>
                <div className="flex gap-2">
                  <button
                    disabled={page100k === 1}
                    onClick={() => setPage100k(p => Math.max(1, p - 1))}
                    aria-label="Predchádzajúca strana"
                    className="p-1.5 rounded-lg border border-line bg-card hover:bg-elevated disabled:opacity-40"
                  >
                    <ChevronLeft className="w-4 h-4 text-muted" aria-hidden="true" />
                  </button>
                  <button
                    disabled={page100k === totalPages100k}
                    onClick={() => setPage100k(p => Math.min(totalPages100k, p + 1))}
                    aria-label="Ďalšia strana"
                    className="p-1.5 rounded-lg border border-line bg-card hover:bg-elevated disabled:opacity-40"
                  >
                    <ChevronRight className="w-4 h-4 text-muted" aria-hidden="true" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* COLUMN 2: Faktúry bez CRZ */}
        <div className={`${activeTab === 'crz' ? 'block' : 'hidden'} lg:block`}>
          <div className="bg-card rounded-2xl shadow-sm border border-line overflow-hidden flex flex-col">
            <div className="bg-red-50 dark:bg-red-950/40 border-b border-red-100 dark:border-red-900 p-6 flex justify-between items-center">
              <div>
                <h2 className="text-lg font-bold text-red-900 dark:text-red-200 flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-red-500" aria-hidden="true" />
                  Faktúry bez zmluvy v CRZ
                </h2>
                <p className="text-xs text-red-700 dark:text-red-300 mt-1">
                  Dodávatelia, ktorí fakturujú mestu, ale v CRZ nebola nájdená žiadna zverejnená zmluva.
                </p>
              </div>
              <span className="bg-red-200/60 text-red-900 text-xs font-bold px-2.5 py-1 rounded-full shrink-0">
                {filteredMissingCrz.length}
              </span>
            </div>
            
            <div className="divide-y divide-line">
              {paginatedMissingCrz.length === 0 ? (
                <div className="p-12 text-center text-muted flex flex-col items-center gap-2">
                  <CheckCircle className="w-8 h-8 text-emerald-500 mb-2" aria-hidden="true" />
                  Pre zadané filtre neboli nájdené žiadne nezrovnalosti.
                </div>
              ) : (
                paginatedMissingCrz.map(alert => (
                  <div key={alert.id} className="p-6 hover:bg-surface transition-colors">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <Link href={`/dodavatel/${alert.supplier?.ico}`} className="text-base font-bold text-blue-600 hover:underline">
                          {alert.supplier?.name || "Neznámy dodávateľ"}
                        </Link>
                        <p className="text-xs text-muted mt-0.5 font-mono">IČO: {alert.supplier?.ico || "Neznáme"}</p>
                      </div>
                      <span className="font-bold text-red-700 bg-red-100 px-3 py-1 rounded-full text-sm font-mono border border-red-200">
                        {formatEur(alert.amount_eur || 0)}
                      </span>
                    </div>
                    
                    <div className="text-sm text-body mb-4 bg-surface p-3 rounded-lg border border-line">
                      <span className="font-medium text-muted block mb-1">Fakturované za:</span>
                      {alert.subject || "Neuvedený predmet"}
                    </div>
                    
                    <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line pt-4">
                      {alert.source_url ? (
                        <a 
                          href={alert.source_url?.startsWith('http') ? alert.source_url : `https://${alert.source_url}`} 
                          target="_blank" 
                          rel="noreferrer" 
                          className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:underline font-semibold bg-blue-50 px-2.5 py-1 rounded-md border border-blue-100"
                        >
                          <FileText className="w-3.5 h-3.5" aria-hidden="true" />
                          Otvoriť PDF faktúru <ExternalLink className="w-3 h-3" aria-hidden="true" />
                        </a>
                      ) : <div></div>}
                      
                      <div className="flex items-center gap-4 text-muted text-xs font-medium ml-auto font-mono">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-muted" aria-hidden="true" /> {formatDate(alert.date_published)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Pagination Controls CRZ */}
            {totalPagesCrz > 1 && (
              <div className="p-4 border-t border-line bg-surface flex items-center justify-between">
                <span className="text-xs text-muted">
                  Strana {pageCrz} z {totalPagesCrz}
                </span>
                <div className="flex gap-2">
                  <button
                    disabled={pageCrz === 1}
                    onClick={() => setPageCrz(p => Math.max(1, p - 1))}
                    aria-label="Predchádzajúca strana"
                    className="p-1.5 rounded-lg border border-line bg-card hover:bg-elevated disabled:opacity-40"
                  >
                    <ChevronLeft className="w-4 h-4 text-muted" aria-hidden="true" />
                  </button>
                  <button
                    disabled={pageCrz === totalPagesCrz}
                    onClick={() => setPageCrz(p => Math.min(totalPagesCrz, p + 1))}
                    aria-label="Ďalšia strana"
                    className="p-1.5 rounded-lg border border-line bg-card hover:bg-elevated disabled:opacity-40"
                  >
                    <ChevronRight className="w-4 h-4 text-muted" aria-hidden="true" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
