import { ShieldCheck } from "lucide-react";

export default function VerifiedBadge({ source, date }: { source: string, date?: string }) {
  return (
    <div className="group relative inline-flex items-center justify-center cursor-help ml-1">
      <ShieldCheck className="w-4 h-4 text-emerald-500 hover:text-emerald-600 transition-colors" />
      
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-max z-50">
        <div className="bg-slate-800 text-white text-xs rounded-lg py-2 px-3 shadow-xl flex flex-col items-center">
          <span className="font-bold flex items-center gap-1">
            <ShieldCheck className="w-3 h-3" /> Overené štátom
          </span>
          <span className="text-slate-300 mt-1">Zdroj: {source}</span>
          {date && <span className="text-slate-400 mt-0.5">Získané: {date}</span>}
          
          {/* Arrow */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
        </div>
      </div>
    </div>
  );
}
