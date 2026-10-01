"use client";

import { DramaVote, RollRow } from "./CouncilDrama";

type VoteCast = "ZA" | "PROTI" | "ZDRŽAL SA" | "NEPRÍTOMNÝ" | "NEHLASOVAL";

const COL: Record<string, string> = {
  ZA: "#10b981",
  PROTI: "#ef4444",
  "ZDRŽAL SA": "#f59e0b",
  NEPRÍTOMNÝ: "#64748b",
  NEHLASOVAL: "#64748b",
};

const ORDER: VoteCast[] = ["ZA", "PROTI", "ZDRŽAL SA", "NEHLASOVAL", "NEPRÍTOMNÝ"];

// Slopegraph: ľavý stĺpec = prvé hlasovanie, pravý = druhé. Každý poslanec je bodka,
// čiara spája jeho dva hlasy. Vyššie = bližšie k schváleniu (ZA hore, PROTI dole).
// Jediný, kto preskočí hranicu kvóra, je ten, kto rozhodol. Tábory + flip v jednom obraze.
export default function DramaSlope({
  v1,
  v2,
  rollcall,
  quorum,
  movers,
}: {
  v1: DramaVote;
  v2: DramaVote;
  rollcall: RollRow[];
  quorum: number;
  movers: Record<string, string>; // meno -> krátka anotácia
}) {
  const seats = rollcall.length;

  const rankMap = (which: "v1" | "v2") => {
    const arr = [...rollcall].sort(
      (a, b) => ORDER.indexOf(a[which]) - ORDER.indexOf(b[which]) || a.name.localeCompare(b.name, "sk")
    );
    const m = new Map<string, number>();
    arr.forEach((r, i) => m.set(r.name, i));
    return m;
  };
  const r1 = rankMap("v1");
  const r2 = rankMap("v2");

  const rowH = 22;
  const topPad = 86;
  const leftX = 250;
  const rightX = leftX + 250;
  const W = rightX + 230;
  const H = topPad + seats * rowH + 40;
  const qy = topPad + quorum * rowH;
  const yof = (rank: number) => topPad + rank * rowH + rowH / 2;

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-[760px] mx-auto" role="img"
        aria-label="Prepojovací graf dvoch hlasovaní o dani z nehnuteľností">
        {/* jemné zelené pozadie nad hranicou = pásmo „za" */}
        <rect x={leftX - 18} y={topPad - 4} width={rightX - leftX + 36} height={qy - topPad + 4} fill="#10b981" opacity={0.06} />
        {/* hranica kvóra */}
        <line x1={leftX - 30} y1={qy} x2={rightX + 30} y2={qy} stroke="var(--foreground)" strokeWidth={1.5} strokeDasharray="6 4" opacity={0.75} />
        <text x={rightX + 34} y={qy - 4} fontSize={12} fill="var(--foreground)" fontWeight="bold">hranica {quorum} hlasov za</text>
        <text x={rightX + 34} y={qy + 13} fontSize={11} fill="var(--muted-foreground)">(3/5 väčšina na daň)</text>

        {/* hlavičky stĺpcov */}
        {[
          { x: leftX, v: v1 },
          { x: rightX, v: v2 },
        ].map(({ x, v }, idx) => {
          const passed = v.result === "PRESLO";
          const rc = passed ? "#10b981" : "#ef4444";
          return (
            <g key={idx}>
              <text x={x} y={30} fontSize={15} fill="var(--foreground)" fontWeight="bold" textAnchor="middle">{v.label}</text>
              <text x={x} y={54} fontSize={22} fill={rc} fontWeight="bold" textAnchor="middle">{v.za} za</text>
              <text x={x} y={72} fontSize={12} fill={rc} fontWeight="bold" textAnchor="middle">{passed ? "PREŠLO" : "NEPREŠLO"}</text>
            </g>
          );
        })}

        {/* spojnice (najprv sivé v pozadí, potom farebné movery navrchu) */}
        {rollcall.filter((r) => !r.changed).map((r) => {
          const y1 = yof(r1.get(r.name)!), y2 = yof(r2.get(r.name)!);
          return (
            <path key={r.name} d={`M ${leftX} ${y1} C ${leftX + 90} ${y1} ${rightX - 90} ${y2} ${rightX} ${y2}`}
              fill="none" stroke="var(--muted-foreground)" strokeWidth={1} opacity={0.4} />
          );
        })}
        {rollcall.filter((r) => r.changed).map((r) => {
          const y1 = yof(r1.get(r.name)!), y2 = yof(r2.get(r.name)!);
          const col = r.v2 === "NEPRÍTOMNÝ" ? "#ef4444" : COL[r.v2];
          return (
            <path key={r.name} d={`M ${leftX} ${y1} C ${leftX + 90} ${y1} ${rightX - 90} ${y2} ${rightX} ${y2}`}
              fill="none" stroke={col} strokeWidth={3.2} opacity={0.95} />
          );
        })}

        {/* bodky + mená */}
        {rollcall.map((r) => {
          const y1 = yof(r1.get(r.name)!), y2 = yof(r2.get(r.name)!);
          return (
            <g key={r.name}>
              <circle cx={leftX} cy={y1} r={6} fill={COL[r.v1]} stroke="var(--card)" strokeWidth={1.5} />
              <circle cx={rightX} cy={y2} r={6} fill={COL[r.v2]} stroke="var(--card)" strokeWidth={1.5} />
              <text x={leftX - 14} y={y1 + 4} fontSize={11} textAnchor="end"
                fill={r.changed ? "var(--foreground)" : "var(--muted-foreground)"}
                fontWeight={r.changed ? "bold" : "normal"}>
                {r.name}
              </text>
            </g>
          );
        })}

        {/* anotácie moverov vpravo */}
        {rollcall.filter((r) => r.changed && movers[r.name]).map((r) => {
          const y2 = yof(r2.get(r.name)!);
          return (
            <text key={r.name} x={rightX + 14} y={y2 + 4} fontSize={11} fill="var(--foreground)" fontWeight="bold">
              {r.name.split(" ").pop()}: {movers[r.name]}
            </text>
          );
        })}
      </svg>

      <div className="flex flex-wrap justify-center gap-4 mt-2 text-xs text-muted">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full" style={{ background: COL.ZA }} /> za</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full" style={{ background: COL.PROTI }} /> proti</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full" style={{ background: COL.NEPRÍTOMNÝ }} /> neprítomný</span>
        <span className="flex items-center gap-1.5"><span className="inline-block w-4 border-t border-dashed border-current" /> hranica na schválenie</span>
      </div>
      <p className="text-xs text-muted text-center mt-2 max-w-xl mx-auto">
        Každý poslanec je bodka, čiara spája jeho dva hlasy. Vyššie = bližšie k schváleniu. Hrubé farebné čiary sú jediní
        dvaja, ktorí sa medzi hlasovaniami pohli — a stačili na obrat.
      </p>
    </div>
  );
}
