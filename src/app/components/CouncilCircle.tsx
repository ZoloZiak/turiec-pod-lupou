"use client";

import { CircleNode, CircleEdge } from "../../lib/councilVotes";

// Kruhový diagram táborov: poslanci po obvode (zoradení podľa zhody s jadrom),
// spojnice medzi tými, čo na SPORNÝCH hlasovaniach hlasujú rovnako (≥80 %).
// Dva zhluky spojníc = dva tábory. Všetko počítané naživo, nič zadané ručne.

const COLORS: Record<string, string> = {
  jadro: "#10b981",      // emerald
  opozicia: "#ef4444",   // red
  swing: "#f59e0b",      // amber
};

export default function CouncilCircle({ nodes, edges }: { nodes: CircleNode[]; edges: CircleEdge[] }) {
  const size = 680;
  const cx = size / 2;
  const cy = size / 2;
  const R = size / 2 - 150; // priestor na mená okolo
  const pad = 95;           // padding okolo kruhu, aby sa dlhé mená neorezali

  const pos = (i: number) => {
    const ang = (i / nodes.length) * 2 * Math.PI - Math.PI / 2;
    return { x: cx + R * Math.cos(ang), y: cy + R * Math.sin(ang), ang };
  };

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`${-pad} ${-pad} ${size + 2 * pad} ${size + 2 * pad}`} className="w-full max-w-[760px] mx-auto" role="img"
        aria-label="Kruhový diagram hlasovacích táborov zastupiteľstva">
        {/* spojnice (chords) — kreslené prvé, pod uzlami */}
        <g>
          {edges.map((e, k) => {
            const a = pos(e.a), b = pos(e.b);
            const na = nodes[e.a], nb = nodes[e.b];
            // farba spojnice podľa tábora (ak rovnaký tábor), inak sivá
            const same = na.group === nb.group ? COLORS[na.group] : "#94a3b8";
            const op = na.group === nb.group ? 0.32 : 0.14;
            // zakrivenie k stredu pre čitateľnosť
            return (
              <path key={k}
                d={`M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}`}
                fill="none" stroke={same} strokeWidth={0.6 + e.w * 1.2} strokeOpacity={op} />
            );
          })}
        </g>
        {/* uzly + mená */}
        <g>
          {nodes.map((n, i) => {
            const p = pos(i);
            const deg = (p.ang * 180) / Math.PI;
            const flip = p.x < cx;
            const lx = cx + (R + 14) * Math.cos(p.ang);
            const ly = cy + (R + 14) * Math.sin(p.ang);
            const r = 5 + Math.min(6, (n.activeCount / 650) * 6);
            return (
              <g key={n.name}>
                <circle cx={p.x} cy={p.y} r={r} fill={COLORS[n.group]} stroke="var(--card)" strokeWidth={1.5} />
                <text
                  x={lx} y={ly}
                  fontSize={11}
                  fill="var(--foreground)"
                  dominantBaseline="middle"
                  textAnchor={flip ? "end" : "start"}
                  transform={flip ? `rotate(${deg + 180} ${lx} ${ly})` : `rotate(${deg} ${lx} ${ly})`}
                >
                  {n.name}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
      <div className="flex flex-wrap justify-center gap-4 mt-2 text-sm">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full" style={{ background: COLORS.jadro }} /> koaličné jadro</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full" style={{ background: COLORS.opozicia }} /> opozičný tábor</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full" style={{ background: COLORS.swing }} /> medzi tábormi (swing)</span>
      </div>
    </div>
  );
}
