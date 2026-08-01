"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle, XCircle } from "lucide-react";

export default function RpvsBadge({ ico }: { ico: string }) {
  const [status, setStatus] = useState<'loading' | 'active' | 'inactive' | 'error'>('loading');

  useEffect(() => {
    if (!ico || ico.startsWith("NO_ICO_")) {
      setStatus("error");
      return;
    }

    fetch(`/api/rpvs/${ico}`)
      .then(res => res.json())
      .then(data => {
        if (data.error) setStatus("error");
        else setStatus(data.active ? "active" : "inactive");
      })
      .catch(() => setStatus("error"));
  }, [ico]);

  if (status === 'loading') {
    return (
      <div className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 text-slate-500 text-xs font-semibold rounded border border-slate-200">
        <span className="w-3 h-3 border-2 border-slate-300 border-t-slate-500 rounded-full animate-spin"></span>
        Overujem RPVS...
      </div>
    );
  }

  if (status === 'active') {
    return (
      <div className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded border border-emerald-200" title="Zákonná povinnosť splnená: Subjekt je zapísaný v Registri partnerov verejného sektora.">
        <CheckCircle className="w-3 h-3" />
        Firma je zapísaná v RPVS
      </div>
    );
  }

  if (status === 'inactive') {
    return (
      <div className="inline-flex items-center gap-1 px-2 py-1 bg-red-50 text-red-700 text-xs font-semibold rounded border border-red-200" title="PORUŠENIE ZÁKONA: Zákazka nad 100 000 € vyžaduje zápis v RPVS, no firma v ňom nie je aktívne zapísaná!">
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
