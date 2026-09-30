"use client";

import { ArrowRight, Check, X, Minus, ExternalLink } from "lucide-react";

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
function dotColor(v: VoteCast) {
  if (v === "ZA") return "bg-emerald-500";
  if (v === "PROTI") return "bg-red-500";
  if (v === "ZDRŽAL SA") return "bg-amber-500";
  return "bg-slate-600"; // neprítomný / nehlasoval
}
function textVote(v: VoteCast) {
  if (v === "ZA") return "text-emerald-400";
  if (v === "PROTI") return "text-red-400";
  if (v === "ZDRŽAL SA") return "text-amber-400";
  return "text-muted";
}

// Jedno hlasovanie ako mriežka bodiek (31 kresiel) + kvórum čiara
function VoteGrid({ vote, quorum, seats }: { vote: DramaVote; quorum: number; seats: number }) {
  // poradie bodiek: ZA, PROTI, zdržal, neprítomný
  const dots: VoteCast[] = [
    ...Array(vote.za).fill("ZA"),
    ...Array(vote.proti).fill("PROTI"),
    ...Array(vote.zdrzal).fill("ZDRŽAL SA"),
    ...Array(vote.nepritomny).fill("NEPRÍTOMNÝ"),
  ] as VoteCast[];
  while (dots.length < seats) dots.push("NEPRÍTOMNÝ");
  const passed = vote.result === "PRESLO";

  return (
    <div className="bg-elevated rounded-xl p-5 border border-line flex-1 min-w-[260px]">
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="text-sm font-semibold text-muted">{vote.label}</span>
        <span
          className={`px-2.5 py-1 rounded-full text-xs font-bold ${
            passed ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"
          }`}
        >
          {passed ? "Prešlo".toUpperCase() : "Neprešlo".toUpperCase()}
        </span>
      </div>
      <div className="text-3xl font-extrabold text-body mb-3">
        {vote.za} <span className="text-lg font-medium text-muted">za</span>
      </div>

      {/* mriežka kresiel */}
      <div className="grid grid-cols-8 gap-1.5 mb-4" aria-hidden="true">
        {dots.map((d, i) => (
          <div key={i} className={`aspect-square rounded-full ${dotColor(d)}`} title={d} />
        ))}
      </div>

      {/* kvórum ukazovateľ */}
      <div className="relative h-2 rounded-full bg-slate-700 overflow-hidden mb-1">
        <div
          className={`h-full ${passed ? "bg-emerald-500" : "bg-red-500"}`}
          style={{ width: `${Math.min(100, (vote.za / seats) * 100)}%` }}
        />
        <div
          className="absolute top-0 h-full w-0.5 bg-body"
          style={{ left: `${(quorum / seats) * 100}%` }}
          title={`Potrebná hranica: ${quorum}`}
        />
      </div>
      <div className="flex justify-between text-[11px] text-muted">
        <span>
          {vote.za} za · {vote.proti} proti
          {vote.zdrzal ? ` · ${vote.zdrzal} zdržal` : ""}
          {vote.nepritomny ? ` · ${vote.nepritomny} neprít.` : ""}
        </span>
        <span className="font-semibold text-body">hranica {quorum}</span>
      </div>

      <a
        href={vote.source}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 mt-3"
      >
        <ExternalLink className="w-3 h-3" aria-hidden="true" /> Uznesenie č. {vote.uznesenie} · martin.sk
      </a>
    </div>
  );
}

export default function CouncilDrama({ drama }: { drama: Drama }) {
  const [v1, v2] = drama.votes;

  return (
    <article className="bg-card rounded-2xl border border-line overflow-hidden">
      {/* hlavička */}
      <div className="p-6 border-b border-line">
        <span className="text-xs font-bold uppercase tracking-wide text-purple-400">{drama.kicker}</span>
        <h2 className="text-2xl font-extrabold text-body mt-1">{drama.title}</h2>
        <p className="text-muted mt-3 max-w-3xl">{drama.summary}</p>
      </div>

      {/* dve hlasovania vedľa seba so šípkou */}
      <div className="p-6">
        <div className="flex flex-col md:flex-row items-stretch gap-4">
          <VoteGrid vote={v1} quorum={drama.quorum} seats={drama.seats} />
          <div className="flex md:flex-col items-center justify-center gap-2 px-2">
            <ArrowRight className="w-8 h-8 text-purple-400 rotate-90 md:rotate-0" aria-hidden="true" />
            <span className="text-xs font-semibold text-muted whitespace-nowrap">o 5 týždňov</span>
          </div>
          <VoteGrid vote={v2} quorum={drama.quorum} seats={drama.seats} />
        </div>

        {/* legenda */}
        <div className="flex flex-wrap gap-4 mt-4 text-xs text-muted">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-emerald-500" /> za</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-red-500" /> proti</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-amber-500" /> zdržal sa</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-slate-600" /> neprítomný</span>
          <span className="flex items-center gap-1.5"><span className="inline-block w-0.5 h-3 bg-body" /> potrebná hranica ({drama.quorum} z {drama.seats})</span>
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
