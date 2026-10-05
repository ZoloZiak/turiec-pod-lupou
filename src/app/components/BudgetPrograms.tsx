"use client";

import { useState, useEffect, useMemo } from "react";
import { ChevronDown, PiggyBank, ExternalLink } from "lucide-react";

type Subprogram = { code: string; name: string; bezne: number; kapital: number };
type Program = { no: number; name: string; total: number; subprograms: Subprogram[] };
type BudgetData = {
  year: number;
  source: string;
  sourceUrl: string;
  totalExpenditure: number;
  totalBezne: number;
  totalKapital: number;
  officialBezne: number;
  officialKapital: number;
  programs: Program[];
};

const eur = (n: number) => n.toLocaleString("sk-SK", { maximumFractionDigits: 0 }) + " €";

// Farebná paleta pre pruhy programov (konzistentná, nie náhodná).
const BAR = "bg-emerald-500/80";
const BAR_CAP = "bg-blue-500/70";

function ProgramRow({ p, maxTotal }: { p: Program; maxTotal: number }) {
  const [open, setOpen] = useState(false);
  const pct = Math.max(1.5, (100 * p.total) / maxTotal);
  const bezne = p.subprograms.reduce((s, x) => s + x.bezne, 0);
  const kapital = p.subprograms.reduce((s, x) => s + x.kapital, 0);
  const maxPp = Math.max(...p.subprograms.map((x) => x.bezne + x.kapital), 1);

  return (
    <div className="rounded-xl border border-line overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full px-4 py-3 text-left hover:bg-elevated/60 transition-colors"
      >
        <div className="flex items-center justify-between gap-3">
          <span className="min-w-0 flex items-baseline gap-2">
            <span className="text-xs text-muted tabular-nums shrink-0">{p.no}.</span>
            <span className="text-sm font-semibold text-body truncate">{p.name}</span>
          </span>
          <span className="flex items-center gap-2 shrink-0">
            <span className="text-sm font-bold text-body tabular-nums">{eur(p.total)}</span>
            <ChevronDown
              className={`w-4 h-4 text-muted transition-transform ${open ? "rotate-180" : ""}`}
              aria-hidden="true"
            />
          </span>
        </div>
        {/* proporčný pruh programu voči najväčšiemu */}
        <div className="mt-2 h-1.5 w-full rounded-full bg-elevated overflow-hidden">
          <div className={`h-full ${BAR}`} style={{ width: `${pct}%` }} />
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 pt-1 border-t border-line/70">
          <p className="text-xs text-muted mt-2 mb-3">
            {p.subprograms.length}{" "}
            {p.subprograms.length === 1 ? "podprogram" : p.subprograms.length < 5 ? "podprogramy" : "podprogramov"}
            {" · "}
            {bezne > 0 && <>bežné {eur(bezne)}</>}
            {bezne > 0 && kapital > 0 && " · "}
            {kapital > 0 && <>kapitálové (investície) {eur(kapital)}</>}
          </p>
          <ul className="space-y-2">
            {p.subprograms.map((s) => {
              const tot = s.bezne + s.kapital;
              const w = Math.max(1, (100 * tot) / maxPp);
              return (
                <li key={s.code} className="text-sm">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 text-body/90 truncate">
                      <span className="text-xs text-muted tabular-nums mr-1.5">{s.code}</span>
                      {s.name}
                    </span>
                    <span className="shrink-0 text-body tabular-nums text-[13px]">{eur(tot)}</span>
                  </div>
                  <div className="mt-1 h-1 w-full rounded-full bg-elevated overflow-hidden flex">
                    {s.bezne > 0 && (
                      <div className={`h-full ${BAR}`} style={{ width: `${Math.max(0.5, (100 * s.bezne) / maxPp)}%` }} />
                    )}
                    {s.kapital > 0 && (
                      <div className={`h-full ${BAR_CAP}`} style={{ width: `${Math.max(0.5, (100 * s.kapital) / maxPp)}%` }} />
                    )}
                    <span style={{ width: `${100 - w}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function BudgetPrograms() {
  const [data, setData] = useState<BudgetData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/data/budget-programs-2025.json")
      .then((r) => r.json())
      .then((d: BudgetData) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const sorted = useMemo(
    () => (data ? [...data.programs].sort((a, b) => b.total - a.total) : []),
    [data]
  );
  const maxTotal = sorted.length ? sorted[0].total : 1;

  if (loading) return <p className="text-sm text-muted">Načítavam rozpočet…</p>;
  if (!data) return <p className="text-sm text-muted">Dáta sa nepodarilo načítať.</p>;

  return (
    <div className="space-y-6">
      {/* HERO */}
      <section className="bg-card rounded-2xl shadow-sm border border-line p-6">
        <div className="flex items-center gap-3 mb-2">
          <PiggyBank className="w-6 h-6 text-emerald-400" aria-hidden="true" />
          <h2 className="text-2xl font-bold text-body">Na čo mesto minulo peniaze v roku {data.year}</h2>
        </div>
        <p className="text-sm text-muted max-w-3xl">
          Lievik na úvodnej stránke ukazuje tok peňazí zhora. Tu je ten istý rok rozobratý{" "}
          <strong className="text-body">do hĺbky</strong>: {data.programs.length} programov → ich
          podprogramy → koľko konkrétne stáli. Klikni na program a rozbalíš, na čo šli peniaze.
        </p>
        <div className="mt-4 flex flex-wrap gap-x-8 gap-y-2">
          <div>
            <p className="text-xs text-muted uppercase tracking-wide">Výdavky spolu</p>
            <p className="text-2xl font-extrabold text-body tabular-nums">{eur(data.totalExpenditure)}</p>
          </div>
          <div>
            <p className="text-xs text-muted uppercase tracking-wide">z toho bežné</p>
            <p className="text-lg font-bold text-body tabular-nums">{eur(data.totalBezne)}</p>
          </div>
          <div>
            <p className="text-xs text-muted uppercase tracking-wide">z toho kapitálové (investície)</p>
            <p className="text-lg font-bold text-body tabular-nums">{eur(data.totalKapital)}</p>
          </div>
        </div>
      </section>

      {/* ZOZNAM PROGRAMOV */}
      <section className="bg-card rounded-2xl shadow-sm border border-line p-6">
        <div className="flex items-center gap-2 mb-1 text-xs text-muted">
          <span className="inline-block w-3 h-2 rounded-sm bg-emerald-500/80" /> bežné výdavky
          <span className="inline-block w-3 h-2 rounded-sm bg-blue-500/70 ml-3" /> kapitálové (investície)
        </div>
        <p className="text-xs text-muted mb-4">Programy zoradené od najväčšieho po najmenší.</p>
        <div className="space-y-2.5">
          {sorted.map((p) => (
            <ProgramRow key={p.no} p={p} maxTotal={maxTotal} />
          ))}
        </div>
      </section>

      {/* METODIKA / ZDROJ */}
      <section className="bg-card rounded-2xl shadow-sm border border-line p-6">
        <h3 className="text-sm font-semibold text-body mb-2">Odkiaľ sú tieto čísla</h3>
        <p className="text-xs text-muted max-w-3xl">
          Zdroj je oficiálny{" "}
          <a href={data.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline inline-flex items-center gap-1">
            Záverečný účet mesta Martin za rok {data.year} <ExternalLink className="w-3 h-3" />
          </a>{" "}
          (Správa o finančnom plnení rozpočtu k 31.&nbsp;12.&nbsp;{data.year}) — teda{" "}
          <strong className="text-body">skutočné čerpanie</strong>, nie schválený plán. Programový
          rozpočet sme z dokumentu prepísali program po programe a súčet sme overili proti
          oficiálnym súhrnom: bežné výdavky {eur(data.totalBezne)} oproti úradným{" "}
          {eur(data.officialBezne)}, kapitálové {eur(data.totalKapital)} oproti {eur(data.officialKapital)} —
          sedí na stotiny percenta (drobný rozdiel je zaokrúhľovanie v dokumente). Splátky úverov sú
          vedené samostatne (finančná operácia), preto nie sú v kapitálových výdavkoch.
        </p>
      </section>
    </div>
  );
}
