"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle, XCircle } from "lucide-react";

export default function RpvsBadge({ ico, name }: { ico: string; name?: string }) {
  const [status, setStatus] = useState<'loading' | 'active' | 'exempt' | 'inactive' | 'error'>('loading');
  const [resolvedIco, setResolvedIco] = useState<string | null>(null);

  useEffect(() => {
    const queryIco = ico || "NO_ICO";
    const url = `/api/rpvs/${encodeURIComponent(queryIco)}${name ? `?name=${encodeURIComponent(name)}` : ''}`;

    fetch(url)
      .then(res => res.json())
      .then(data => {
        if (data.error) setStatus("error");
        else if (data.exempt) {
          setStatus("exempt");
        } else {
          setStatus(data.active ? "active" : "inactive");
          if (data.ico) setResolvedIco(data.ico);
        }
      })
      .catch(() => setStatus("error"));
  }, [ico, name]);

  if (status === 'loading') {
    return (
      <div className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 text-slate-500 text-xs font-semibold rounded border border-slate-200">
        <span className="w-3 h-3 border-2 border-slate-300 border-t-slate-500 rounded-full animate-spin"></span>
        Overujem RPVS...
      </div>
    );
  }

  if (status === 'exempt') {
    return (
      <div 
        className="inline-flex items-center gap-1.5 px-2 py-1 bg-amber-500/10 text-amber-400 text-xs font-semibold rounded border border-amber-500/20"
        title="Firma nie je zapísaná v RPVS, no vzťahuje sa na ňu zákonná výnimka podľa § 2 ods. 3 Zákona č. 315/2016 Z. z. (napr. banky a úverové inštitúcie)."
      >
        <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
        Firma nie je v RPVS (má výnimku)
      </div>
    );
  }

  if (status === 'active') {
    return (
      <a 
        href={`https://rpvs.gov.sk/rpvs/Partner/Partner/Vyhladavanie?NazovPodniku=&Ico=${resolvedIco || ico}`}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold rounded border border-emerald-200 transition-colors" 
        title="Zákonná povinnosť splnená: Subjekt je zapísaný v Registri partnerov verejného sektora."
      >
        <CheckCircle className="w-3 h-3" />
        Firma je zapísaná v RPVS
      </a>
    );
  }

  if (status === 'inactive') {
    return (
      <div className="inline-flex items-center gap-1 px-2 py-1 bg-red-50 text-red-700 text-xs font-semibold rounded border border-red-200" title="Zákazka nad 100 000 € vyžaduje zápis v RPVS, no pre tento subjekt nebol nájdený aktívny zápis v RPVS!">
        <XCircle className="w-3 h-3" />
        POZOR! Zákazka nad 100k, ale firma NIE JE v RPVS!
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-1 px-2 py-1 bg-amber-50 text-amber-700 text-xs font-semibold rounded border border-amber-200">
      <AlertTriangle className="w-3 h-3" />
      Zákazka nad 100k (RPVS nedostupné)
    </div>
  );
}
