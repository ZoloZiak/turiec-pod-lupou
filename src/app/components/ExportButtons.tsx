"use client";

import { Download } from "lucide-react";
import { downloadCSV, downloadJSON } from "../../lib/exportData";

type Row = Record<string, string | number | boolean | null | undefined>;

interface Props {
  /** Riadky na export (už sfiltrované/pripravené volajúcim). */
  rows: Row[];
  /** Základ názvu súboru bez prípony, napr. "zmluvy-mesta-martin". */
  basename: string;
  /** Voliteľné stĺpce (poradie + hlavičky). Bez nich sa použijú kľúče prvého riadku. */
  columns?: { key: string; label: string }[];
  /** Voliteľný label vysvetľujúci rozsah, napr. "20 276 zmlúv". */
  countLabel?: string;
}

export default function ExportButtons({ rows, basename, columns, countLabel }: Props) {
  const disabled = rows.length === 0;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-muted mr-1">
        Stiahnuť {countLabel ? countLabel : `${rows.length.toLocaleString("sk-SK")} záznamov`}:
      </span>
      <button
        onClick={() => downloadCSV(rows, basename, columns)}
        disabled={disabled}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-line bg-card text-sm font-medium text-body hover:border-emerald-500/50 hover:text-emerald-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Download className="w-3.5 h-3.5" aria-hidden="true" /> CSV
      </button>
      <button
        onClick={() => downloadJSON(rows, basename)}
        disabled={disabled}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-line bg-card text-sm font-medium text-body hover:border-emerald-500/50 hover:text-emerald-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Download className="w-3.5 h-3.5" aria-hidden="true" /> JSON
      </button>
    </div>
  );
}
