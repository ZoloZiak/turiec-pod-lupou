"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle, XCircle, ExternalLink } from "lucide-react";

export default function RpvsBadge({ ico, name }: { ico: string; name?: string }) {
  const [status, setStatus] = useState<'loading' | 'active' | 'exempt' | 'inactive' | 'error'>('loading');
  const [resolvedIco, setResolvedIco] = useState<string | null>(null);
  const [partnerId, setPartnerId] = useState<number | null>(null);

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
          if (data.partnerId) setPartnerId(data.partnerId);
        }
      })
      .catch(() => setStatus("error"));
  }, [ico, name]);

  if (status === 'loading') {
    return (
      <div className="inline-flex items-center gap-1 px-2 py-1 bg-elevated text-muted text-xs font-semibold rounded border border-line">
        <span className="w-3 h-3 border-2 border-line border-t-slate-500 rounded-full animate-spin"></span>
        Overujem RPVS...
      </div>
    );
  }

  if (status === 'exempt') {
    return (
      <div 
        className="inline-flex items-center gap-1.5 px-2 py-1 bg-amber-500/10 text-amber-400 text-xs font-semibold rounded border border-amber-500/20"
        title="Subjekt nie je zapísaný v RPVS, pretože podlieha zákonnej výnimke podľa § 2 ods. 3 Zákona č. 315/2016 Z. z. (štátne orgány, ministerstvá, štátne fondy, obce, banky)."
      >
        <AlertTriangle className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
        Subjekt nie je v RPVS (má výnimku)
      </div>
    );
  }

  const detailUrl = partnerId 
    ? `https://rpvs.gov.sk/rpvs/Partner/Partner/Detail/${partnerId}`
    : `https://finstat.sk/${resolvedIco || ico}`;

  if (status === 'active') {
    return (
      <a 
        href={detailUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold rounded border border-emerald-200 transition-colors" 
        title="Zákonná povinnosť splnená: Subjekt je zapísaný v Registri partnerov verejného sektora."
      >
        <CheckCircle className="w-3 h-3" aria-hidden="true" />
        Firma je zapísaná v RPVS
      </a>
    );
  }

  if (status === 'inactive') {
    const checkUrl = `/api/rpvs-redirect/${resolvedIco || ico}`;
    return (
      <a 
        href={checkUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-700 hover:text-red-800 text-xs font-semibold rounded border border-red-200 transition-colors shadow-sm"
        title="Kliknutím overíte zápis v Registri partnerov verejného sektora (RPVS)"
      >
        <XCircle className="w-3.5 h-3.5 text-red-600 shrink-0" aria-hidden="true" />
        <span>POZOR! Zákazka nad 100k, ale firma NIE JE v RPVS!</span>
        <ExternalLink className="w-3 h-3 text-red-500 ml-0.5 shrink-0" aria-hidden="true" />
      </a>
    );
  }

  return (
    <div className="inline-flex items-center gap-1 px-2 py-1 bg-amber-50 text-amber-700 text-xs font-semibold rounded border border-amber-200">
      <AlertTriangle className="w-3 h-3" aria-hidden="true" />
      Zákazka nad 100k (RPVS nedostupné)
    </div>
  );
}
