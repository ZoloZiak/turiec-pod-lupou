import { ShieldCheck } from "lucide-react";

// Zdroje, ktoré sú naozaj oficiálne štátne registre/inštitúcie.
// Pri nich je popisok "Overené štátom" pravdivý; pri ostatných (FinStat,
// mestské faktúry, ...) použijeme neutrálne "Zdroj údajov", aby text neklamal.
const STATNE_ZDROJE = /RÚZ|RUZ|RPO|CRZ|NKÚ|NKU|ŠÚ SR|SU SR|NRSR|ITMS|Data\.gov|registeruz|statistics\.sk/i;

export default function VerifiedBadge({ source, date }: { source: string, date?: string }) {
  const jeStatny = STATNE_ZDROJE.test(source || "");
  const nadpis = jeStatny ? "Overené štátom" : "Zdroj údajov";

  return (
    <div className="group relative inline-flex items-center justify-center cursor-help ml-1">
      <ShieldCheck className={`w-4 h-4 transition-colors ${jeStatny ? "text-emerald-500 hover:text-emerald-600" : "text-muted hover:text-muted"}`} role="img" aria-label={nadpis} />

      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-max z-50">
        <div className="bg-elevated text-body text-xs rounded-lg py-2 px-3 shadow-xl flex flex-col items-center">
          <span className="font-bold flex items-center gap-1">
            <ShieldCheck className="w-3 h-3" aria-hidden="true" /> {nadpis}
          </span>
          <span className="text-body mt-1">Zdroj: {source}</span>
          {date && <span className="text-muted mt-0.5">Získané: {date}</span>}

          {/* Arrow */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
        </div>
      </div>
    </div>
  );
}
