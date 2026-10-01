"use client";

import { ArrowRight, Check, X, Minus, ExternalLink } from "lucide-react";
import DramaSlope from "./DramaSlope";

type VoteCast = "ZA" | "PROTI" | "ZDRŽAL SA" | "NEPRÍTOMNÝ" | "NEHLASOVAL";

export type DramaVote = {
  date: string;
  label: string;
  result: "PRESLO" | "NEPRESLO";
  za: number;
  proti: number;
  zdrzal: number;
  nepritomny: number;
  uznesenie: string;
  source: string;
};

export type DramaChange = {
  name: string;
  from: VoteCast;
  to: VoteCast;
  note: string;
};

export type RollRow = { name: string; v1: VoteCast; v2: VoteCast; changed: boolean };

export type Drama = {
  slug: string;
  title: string;
  kicker: string;
  summary: string;
  quorum: number;
  seats: number;
  votes: DramaVote[];
  changes: DramaChange[];
  rollcall: RollRow[];
};

// Farba podľa hlasu — konzistentné so stránkou /poslanci
function textVote(v: VoteCast) {
  if (v === "ZA") return "text-emerald-400";
  if (v === "PROTI") return "text-red-400";
  if (v === "ZDRŽAL SA") return "text-amber-400";
  return "text-muted";
}

export default function CouncilDrama({ drama }: { drama: Drama }) {
  const [v1, v2] = drama.votes;

  // krátke anotácie moverov pre slopegraph (odvodené z changes)
  const moverNotes: Record<string, string> = {};
  for (const c of drama.changes) {
    moverNotes[c.name] =
      c.to === "NEPRÍTOMNÝ" ? "neprišiel (bol PROTI)" : `otočil ${c.from}→${c.to}`;
  }

  return (
    <article className="bg-card rounded-2xl border border-line overflow-hidden">
      {/* hlavička */}
      <div className="p-6 border-b border-line">
        <span className="text-xs font-bold uppercase tracking-wide text-purple-400">{drama.kicker}</span>
        <h2 className="text-2xl font-extrabold text-body mt-1">{drama.title}</h2>
        <p className="text-muted mt-3 max-w-3xl">{drama.summary}</p>
      </div>

      {/* prepojovací graf oboch hlasovaní — tábory aj flip v jednom obraze */}
      <div className="p-6">
        <DramaSlope
          v1={v1}
          v2={v2}
          rollcall={drama.rollcall}
          quorum={drama.quorum}
          movers={moverNotes}
        />

        {/* zdroje — odkazy na oficiálne uznesenia */}
        <div className="flex flex-wrap gap-x-6 gap-y-2 mt-5 justify-center">
          {drama.votes.map((v) => (
            <a key={v.uznesenie} href={v.source} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300">
              <ExternalLink className="w-3 h-3" aria-hidden="true" /> {v.label}: uznesenie č. {v.uznesenie} · martin.sk
            </a>
          ))}
        </div>
      </div>

      {/* čo sa zmenilo — jadro príbehu */}
      <div className="px-6 pb-6">
        <h3 className="text-sm font-bold text-body mb-3 uppercase tracking-wide">Čo sa medzi hlasovaniami zmenilo</h3>
        <div className="space-y-3">
          {drama.changes.map((c) => (
            <div key={c.name} className="bg-elevated rounded-xl p-4 border border-line">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="font-bold text-body">{c.name}</span>
                <span className="flex items-center gap-2 text-sm">
                  <span className={`font-semibold ${textVote(c.from)}`}>{c.from}</span>
                  <ArrowRight className="w-4 h-4 text-muted" aria-hidden="true" />
                  <span className={`font-semibold ${textVote(c.to)}`}>{c.to}</span>
                </span>
              </div>
              <p className="text-sm text-muted mt-2">{c.note}</p>
            </div>
          ))}
        </div>
      </div>

      {/* úplný menný rozpad — poctivosť: každý poslanec, obe hlasovania */}
      <details className="border-t border-line">
        <summary className="px-6 py-4 cursor-pointer text-sm font-semibold text-body hover:bg-elevated select-none">
          Zobraziť úplný menný rozpad ({drama.rollcall.length} poslancov, obe hlasovania)
        </summary>
        <div className="px-6 pb-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-muted">
                <th className="px-3 py-2 font-semibold">Poslanec</th>
                <th className="px-3 py-2 font-semibold text-center">{v1.label}</th>
                <th className="px-3 py-2 font-semibold text-center">{v2.label}</th>
              </tr>
            </thead>
            <tbody>
              {drama.rollcall.map((r) => (
                <tr
                  key={r.name}
                  className={`border-b border-line last:border-0 ${
                    r.changed ? "bg-purple-500/10" : ""
                  }`}
                >
                  <td className="px-3 py-2 text-body">
                    {r.name}
                    {r.changed && (
                      <span className="ml-2 text-[10px] font-bold uppercase text-purple-400">zmena</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <VoteChip v={r.v1} />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <VoteChip v={r.v2} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </article>
  );
}

function VoteChip({ v }: { v: VoteCast }) {
  const icon =
    v === "ZA" ? <Check className="w-3 h-3" /> : v === "PROTI" ? <X className="w-3 h-3" /> : <Minus className="w-3 h-3" />;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold ${textVote(v)}`}>
      {icon}
      {v}
    </span>
  );
}
