"use client";

import { Users, ThumbsUp, ThumbsDown, FileText, ExternalLink, MinusCircle } from "lucide-react";
import Link from "next/link";
import VerifiedBadge from "../components/VerifiedBadge";
import { useState, useEffect, useMemo } from "react";

type Vote = {
  id: string;
  councillor_name: string;
  district: string | null;
  vote_cast: string;
  issue_title: string;
  vote_date: string;
  source_url: string | null;
};

const VOTE_ORDER = ["ZA", "PROTI", "ZDRŽAL SA", "NEHLASOVAL", "NEPRÍTOMNÝ"];

function voteClass(v: string) {
  if (v === "ZA") return "bg-emerald-100 text-emerald-700";
  if (v === "PROTI") return "bg-red-100 text-red-700";
  if (v === "ZDRŽAL SA") return "bg-amber-100 text-amber-700";
  return "bg-elevated text-muted";
}

export default function PoslanciPage() {
  const [votes, setVotes] = useState<Vote[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/dataset?table=city_council_votes');
        const json = await res.json();
        if (json.success) setVotes(json.rows);
      } catch {
        // necháme prázdny stav
      }
      setLoading(false);
    }
    fetchData();
  }, []);

  // zoskup hlasy do jednotlivých hlasovaní (kauz) podľa dátum + titul
  const issues = useMemo(() => {
    const map = new Map<string, { key: string; title: string; date: string; source: string | null; rows: Vote[] }>();
    for (const v of votes) {
      const key = `${v.vote_date}||${v.issue_title}`;
      if (!map.has(key)) map.set(key, { key, title: v.issue_title, date: v.vote_date, source: v.source_url, rows: [] });
      map.get(key)!.rows.push(v);
    }
    const arr = Array.from(map.values());
    // spočítaj "spornosť" = koľko PROTI+ZDRŽAL SA; kontroverzné navrch
    for (const it of arr) {
      (it as unknown as { contested: number }).contested =
        it.rows.filter(r => r.vote_cast === "PROTI" || r.vote_cast === "ZDRŽAL SA").length;
    }
    arr.sort((a, b) => {
      const ca = (a as unknown as { contested: number }).contested;
      const cb = (b as unknown as { contested: number }).contested;
      if (cb !== ca) return cb - ca;
      return b.date.localeCompare(a.date);
    });
    return arr;
  }, [votes]);

  const current = useMemo(() => {
    if (!issues.length) return null;
    const key = selected ?? issues[0].key;
    return issues.find(i => i.key === key) ?? issues[0];
  }, [issues, selected]);

  const summary = useMemo(() => {
    if (!current) return {} as Record<string, number>;
    const s: Record<string, number> = {};
    for (const r of current.rows) s[r.vote_cast] = (s[r.vote_cast] || 0) + 1;
    return s;
  }, [current]);

  const sortedRows = useMemo(() => {
    if (!current) return [];
    return [...current.rows].sort((a, b) => {
      const oa = VOTE_ORDER.indexOf(a.vote_cast); const ob = VOTE_ORDER.indexOf(b.vote_cast);
      if (oa !== ob) return oa - ob;
      return a.councillor_name.localeCompare(b.councillor_name, "sk");
    });
  }, [current]);

  return (
    <div className="min-h-screen bg-surface text-body pb-20">
      <header className="bg-card text-body pt-16 pb-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <Link href="/" className="text-sm font-medium text-muted hover:text-body mb-4 block">&larr; Dashboard</Link>
          <h1 className="text-4xl font-extrabold flex items-center gap-3"><Users className="w-10 h-10 text-purple-400" aria-hidden="true" /> Ako hlasovali poslanci</h1>
          <p className="text-lg text-muted mt-4 max-w-2xl">Menovité hlasovania Mestského zastupiteľstva v Martine – presne tak, ako ich zverejňuje mesto (systém H.E.R.). Vyberte hlasovanie a pozrite, ako hlasoval každý poslanec.</p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-12 space-y-6">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          </div>
        ) : issues.length === 0 ? (
          <div className="bg-card rounded-2xl shadow-sm border border-line p-12 text-center">
            <h3 className="text-xl font-bold text-body mb-2">Zatiaľ žiadne dáta</h3>
            <p className="text-muted">Čaká sa na stiahnutie a vyhodnotenie prvých hlasovaní z MsZ.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Zoznam hlasovaní */}
            <div className="lg:col-span-1 bg-card rounded-2xl shadow-sm border border-line p-4 max-h-[70vh] overflow-y-auto">
              <div className="flex items-center gap-2 mb-3 px-2">
                <FileText className="w-5 h-5 text-purple-600" aria-hidden="true" />
                <span className="font-bold text-body">Hlasovania ({issues.length})</span>
              </div>
              <p className="text-xs text-muted px-2 mb-3">Zoradené podľa spornosti – kontroverzné navrchu.</p>
              <ul className="space-y-1">
                {issues.map(it => {
                  const contested = (it as unknown as { contested: number }).contested;
                  const isActive = current?.key === it.key;
                  return (
                    <li key={it.key}>
                      <button
                        onClick={() => setSelected(it.key)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${isActive ? "bg-purple-100 dark:bg-purple-950/50 text-purple-900 dark:text-purple-100 font-semibold" : "hover:bg-elevated text-body"}`}
                      >
                        <span className="block">{it.title}</span>
                        <span className="block text-xs text-muted mt-0.5">
                          {it.date}{contested > 0 && <span className="ml-2 text-amber-600 font-bold">· {contested} proti/zdržal</span>}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Detail hlasovania */}
            <div className="lg:col-span-2 space-y-4">
              {current && (
                <>
                  <div className="bg-card rounded-2xl shadow-sm border border-line p-6">
                    <div className="flex items-start justify-between gap-4">
                      <h2 className="text-xl font-bold text-body">{current.title}</h2>
                      <VerifiedBadge source="Záznam hlasovania MsZ Martin (H.E.R.)" date={current.date} />
                    </div>
                    <p className="text-sm text-muted mt-1">Dátum zasadnutia: {current.date}</p>

                    <div className="flex flex-wrap gap-2 mt-4">
                      {VOTE_ORDER.filter(v => summary[v]).map(v => (
                        <span key={v} className={`px-3 py-1 rounded-full text-sm font-bold ${voteClass(v)}`}>
                          {v}: {summary[v]}
                        </span>
                      ))}
                    </div>

                    {current.source && (
                      <a href={current.source} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm text-purple-600 hover:text-purple-800 mt-4">
                        <ExternalLink className="w-4 h-4" aria-hidden="true" /> Zobraziť oficiálny záznam na martin.sk
                      </a>
                    )}
                  </div>

                  <div className="bg-card rounded-2xl shadow-sm border border-line overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-line text-left text-muted">
                          <th className="px-4 py-3 font-semibold">Poslanec</th>
                          <th className="px-4 py-3 font-semibold text-right">Hlasoval(a)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedRows.map(r => (
                          <tr key={r.id} className="border-b border-line last:border-0">
                            <td className="px-4 py-2.5 text-body">{r.councillor_name}</td>
                            <td className="px-4 py-2.5 text-right">
                              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold text-xs ${voteClass(r.vote_cast)}`}>
                                {r.vote_cast === "ZA" && <ThumbsUp className="w-3.5 h-3.5" aria-hidden="true" />}
                                {r.vote_cast === "PROTI" && <ThumbsDown className="w-3.5 h-3.5" aria-hidden="true" />}
                                {r.vote_cast === "ZDRŽAL SA" && <MinusCircle className="w-3.5 h-3.5" aria-hidden="true" />}
                                {r.vote_cast}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
