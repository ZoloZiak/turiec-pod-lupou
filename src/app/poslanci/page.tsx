"use client";

import SiteNav from "../components/SiteNav";
import { Users, ThumbsUp, ThumbsDown, FileText, ExternalLink, MinusCircle, Search } from "lucide-react";
import Link from "next/link";
import VerifiedBadge from "../components/VerifiedBadge";
import { useState, useEffect, useMemo } from "react";
import {
  CouncilData, Voting, decodeAll, voteClass, VOTE_ORDER,
} from "../../lib/councilVotes";

export default function PoslanciPage() {
  const [data, setData] = useState<CouncilData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    fetch("/data/council-votes.json")
      .then((r) => r.json())
      .then((d: CouncilData) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const votings: Voting[] = useMemo(() => (data ? decodeAll(data) : []), [data]);

  // Zoznam hlasovani: filter podla hladania, zoradene kontroverzne navrch
  const issues = useMemo(() => {
    const q = query.trim().toLowerCase();
    const arr = q
      ? votings.filter(
          (v) =>
            v.title.toLowerCase().includes(q) ||
            (v.resolution ?? "").toLowerCase().includes(q) ||
            v.date.includes(q)
        )
      : votings.slice();
    arr.sort((a, b) => {
      if (b.contested !== a.contested) return b.contested - a.contested;
      return b.date.localeCompare(a.date);
    });
    return arr;
  }, [votings, query]);

  const current = useMemo(() => {
    if (!issues.length) return null;
    const key = selected ?? issues[0].key;
    return issues.find((i) => i.key === key) ?? issues[0];
  }, [issues, selected]);

  const summary = useMemo(() => {
    if (!current) return {} as Record<string, number>;
    const s: Record<string, number> = {};
    for (const r of current.rows) s[r.cast] = (s[r.cast] || 0) + 1;
    return s;
  }, [current]);

  const sortedRows = useMemo(() => {
    if (!current) return [];
    return [...current.rows].sort((a, b) => {
      const oa = VOTE_ORDER.indexOf(a.cast);
      const ob = VOTE_ORDER.indexOf(b.cast);
      if (oa !== ob) return oa - ob;
      return a.name.localeCompare(b.name, "sk");
    });
  }, [current]);

  return (
    <div className="min-h-screen bg-surface text-body pb-20">
      <SiteNav />
      <header className="bg-card text-body pt-16 pb-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <Link href="/" className="text-sm font-medium text-muted hover:text-body mb-4 block">&larr; Dashboard</Link>
          <h1 className="text-4xl font-extrabold flex items-center gap-3"><Users className="w-10 h-10 text-purple-400" aria-hidden="true" /> Ako hlasovali poslanci</h1>
          <p className="text-lg text-muted mt-4 max-w-2xl">Menovité hlasovania Mestského zastupiteľstva v Martine – presne tak, ako ich zverejňuje mesto (systém H.E.R.). Vyberte hlasovanie a pozrite, ako hlasoval každý poslanec.</p>
          {data && (
            <p className="text-sm text-muted mt-3">
              {data.meta.voting_count.toLocaleString("sk")} hlasovaní od {data.meta.range[0]} do {data.meta.range[1]}.{" "}
              <Link href="/dramy" className="text-purple-400 hover:text-purple-300 underline">Pozrite kľúčové drámy →</Link>
            </p>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-12 space-y-6">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          </div>
        ) : issues.length === 0 && !query ? (
          <div className="bg-card rounded-2xl shadow-sm border border-line p-12 text-center">
            <h3 className="text-xl font-bold text-body mb-2">Zatiaľ žiadne dáta</h3>
            <p className="text-muted">Čaká sa na stiahnutie a vyhodnotenie prvých hlasovaní z MsZ.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Zoznam hlasovaní */}
            <div className="lg:col-span-1 bg-card rounded-2xl shadow-sm border border-line p-4 max-h-[75vh] overflow-y-auto">
              <div className="flex items-center gap-2 mb-3 px-2">
                <FileText className="w-5 h-5 text-purple-600" aria-hidden="true" />
                <span className="font-bold text-body">Hlasovania ({issues.length})</span>
              </div>
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" aria-hidden="true" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setSelected(null); }}
                  placeholder="Hľadať tému, uznesenie, dátum…"
                  className="w-full pl-9 pr-3 py-2 rounded-lg bg-elevated border border-line text-sm text-body placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <p className="text-xs text-muted px-2 mb-3">Zoradené podľa spornosti – kontroverzné navrchu.</p>
              {issues.length === 0 ? (
                <p className="text-sm text-muted px-2 py-4">Nič sa nenašlo pre „{query}“.</p>
              ) : (
                <ul className="space-y-1">
                  {issues.map((it) => {
                    const isActive = current?.key === it.key;
                    return (
                      <li key={it.key}>
                        <button
                          onClick={() => setSelected(it.key)}
                          className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${isActive ? "bg-purple-100 dark:bg-purple-950/50 text-purple-900 dark:text-purple-100 font-semibold" : "hover:bg-elevated text-body"}`}
                        >
                          <span className="block">{it.title}</span>
                          <span className="block text-xs text-muted mt-0.5">
                            {it.date}{it.contested > 0 && <span className="ml-2 text-amber-600 font-bold">· {it.contested} proti/zdržal</span>}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
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
                    <p className="text-sm text-muted mt-1">
                      Dátum zasadnutia: {current.date}
                      {current.resolution && <> · Uznesenie č. {current.resolution}</>}
                    </p>

                    <div className="flex flex-wrap gap-2 mt-4">
                      {VOTE_ORDER.filter((v) => summary[v]).map((v) => (
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
                        {sortedRows.map((r) => (
                          <tr key={r.name} className="border-b border-line last:border-0">
                            <td className="px-4 py-2.5 text-body">{r.name}</td>
                            <td className="px-4 py-2.5 text-right">
                              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold text-xs ${voteClass(r.cast)}`}>
                                {r.cast === "ZA" && <ThumbsUp className="w-3.5 h-3.5" aria-hidden="true" />}
                                {r.cast === "PROTI" && <ThumbsDown className="w-3.5 h-3.5" aria-hidden="true" />}
                                {r.cast === "ZDRŽAL SA" && <MinusCircle className="w-3.5 h-3.5" aria-hidden="true" />}
                                {r.cast}
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
