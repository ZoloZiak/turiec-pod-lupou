"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { sankey, sankeyLinkHorizontal } from "d3-sankey";
import { ArrowRight, Info, ExternalLink } from "lucide-react";
import {
  INCOME, HUB, OUTFLOW, LINKS, HUB as _HUB,
  TOTAL_IN, TOTAL_OUT, BUDGET_YEAR, SOURCE, REGISTERS,
  type FlowNode,
} from "@/data/budget-flow-2025";

const ALL_NODES: FlowNode[] = [...INCOME, HUB, ...OUTFLOW];
void _HUB;

const eurFull = (v: number) =>
  new Intl.NumberFormat("sk-SK", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);
const eurMil = (v: number) => `${(v / 1e6).toFixed(1).replace(".", ",")} mil. €`;

// ── d3-sankey layout typy (po výpočte) ──────────────────────────────────────
type LaidNode = FlowNode & { x0: number; x1: number; y0: number; y1: number; value: number };
type LaidLink = {
  source: LaidNode; target: LaidNode; value: number; width: number; y0: number; y1: number;
};

const W = 1000, H = 560;

export default function BudgetFunnel() {
  const router = useRouter();
  const [active, setActive] = useState<string | null>(null);

  const { nodes, links } = useMemo(() => {
    const gen = sankey<FlowNode, { value: number }>()
      .nodeId((d) => d.id)
      .nodeWidth(22)
      .nodePadding(26)
      .extent([[158, 24], [W - 168, H - 24]]);
    // d3-sankey mutuje vstup — podaj čerstvé kópie
    const graph = gen({
      nodes: ALL_NODES.map((d) => ({ ...d })),
      links: LINKS.map((d) => ({ ...d })),
    });
    return { nodes: graph.nodes as unknown as LaidNode[], links: graph.links as unknown as LaidLink[] };
  }, []);

  const linkPath = useMemo(() => sankeyLinkHorizontal<FlowNode, { value: number }>(), []);

  const activeNode = active ? ALL_NODES.find((n) => n.id === active) ?? null : null;
  const activeAmount =
    activeNode?.side === "hub"
      ? TOTAL_IN
      : LINKS.filter((l) => l.source === active || l.target === active).reduce((s, l) => s + l.value, 0);

  const isLinkLit = (l: LaidLink) =>
    !active || l.source.id === active || l.target.id === active;

  return (
    <section className="w-full">
      {/* NADPIS */}
      <div className="mb-5">
        <h1 className="text-2xl sm:text-3xl font-black text-body tracking-tight">
          Tok peňazí mesta Martin — rok {BUDGET_YEAR}
        </h1>
        <p className="text-sm text-muted mt-1.5 max-w-2xl">
          Odkiaľ mesto peniaze dostane, zlejú sa na úrade a znova sa rozdelia. Reálne čísla z{" "}
          <a href={SOURCE.page} target="_blank" rel="noreferrer" className="text-emerald-400 hover:underline">
            záverečného účtu za rok {BUDGET_YEAR}
          </a>{" "}
          (skutočné plnenie k 31.12.{BUDGET_YEAR}).
        </p>
      </div>

      {/* ── DESKTOP: SVG sankey lievik ── */}
      <div className="hidden lg:block bg-card border border-line rounded-3xl p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-2 px-1 text-[11px] font-bold uppercase tracking-widest text-muted">
          <span>① Odkiaľ prídu · {eurMil(TOTAL_IN)}</span>
          <span>② Mesto rozhodne</span>
          <span>③ Kam idú · {eurMil(TOTAL_OUT)} + rezerva</span>
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block", overflow: "visible" }}
             role="img" aria-label="Diagram toku peňazí mesta Martin za rok 2025">
          {/* LINKY */}
          <g>
            {links.map((l, i) => (
              <path
                key={i}
                d={linkPath(l as never) ?? undefined}
                fill="none"
                stroke={(l.source.side === "hub" ? l.target.color : l.source.color)}
                strokeOpacity={isLinkLit(l) ? 0.5 : 0.12}
                strokeWidth={Math.max(1.5, l.width)}
                style={{ transition: "stroke-opacity .15s" }}
              />
            ))}
          </g>
          {/* UZLY */}
          <g>
            {nodes.map((n) => {
              const h = Math.max(2, n.y1 - n.y0);
              const clickable = !!n.href;
              const dim = active && active !== n.id &&
                !LINKS.some((l) => (l.source === active && l.target === n.id) || (l.target === active && l.source === n.id));
              return (
                <g key={n.id}
                   onMouseEnter={() => setActive(n.id)}
                   onMouseLeave={() => setActive(null)}
                   onClick={() => n.href && router.push(n.href)}
                   style={{ cursor: clickable ? "pointer" : "default", opacity: dim ? 0.4 : 1, transition: "opacity .15s" }}>
                  <rect x={n.x0} y={n.y0} width={n.x1 - n.x0} height={h} rx={5}
                        fill={n.color} fillOpacity={n.side === "hub" ? 0.22 : 0.92}
                        stroke={n.side === "hub" ? n.color : "none"} strokeWidth={n.side === "hub" ? 2 : 0} />
                  {/* label */}
                  {n.side === "in" && (
                    <text x={n.x0 - 10} y={(n.y0 + n.y1) / 2} textAnchor="end" dominantBaseline="middle"
                          fontSize={15} fontWeight={700} fill="var(--body)">
                      <tspan>{n.label}</tspan>
                      <tspan x={n.x0 - 10} dy={17} fontSize={12.5} fontWeight={800} fill="var(--muted)">{eurMil(n.value)}</tspan>
                    </text>
                  )}
                  {n.side === "out" && (
                    <text x={n.x1 + 10} y={(n.y0 + n.y1) / 2} textAnchor="start" dominantBaseline="middle"
                          fontSize={15} fontWeight={700} fill={clickable ? "#3b82f6" : "var(--body)"}>
                      <tspan>{n.label}{clickable ? " ›" : ""}</tspan>
                      <tspan x={n.x1 + 10} dy={17} fontSize={12.5} fontWeight={800} fill="var(--muted)">{eurMil(n.value)}</tspan>
                    </text>
                  )}
                  {n.side === "hub" && (
                    <text x={(n.x0 + n.x1) / 2} y={(n.y0 + n.y1) / 2} textAnchor="middle" dominantBaseline="middle"
                          fontSize={15} fontWeight={800} fill="#059669">
                      <tspan x={(n.x0 + n.x1) / 2}>MESTO</tspan>
                      <tspan x={(n.x0 + n.x1) / 2} dy={18}>MARTIN</tspan>
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        </svg>

        {/* INFO PANEL (ELI5 vysvetlenie pri hoveri) */}
        <div className="mt-4 flex items-start gap-3 rounded-xl border border-line bg-elevated/40 px-4 py-3 min-h-[64px]">
          <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
          {activeNode ? (
            <p className="text-sm text-body leading-relaxed">
              <span className="font-bold" style={{ color: activeNode.color === "#e7ecf5" ? "#34d399" : activeNode.color }}>
                {activeNode.label} — {eurFull(activeAmount)}
              </span>
              <span className="text-muted"> · {activeNode.hint}</span>
            </p>
          ) : (
            <p className="text-sm text-muted leading-relaxed">
              Prejdi myšou po ktoromkoľvek pruhu. Mesto v roku {BUDGET_YEAR} prijalo{" "}
              <b className="text-body">{eurFull(TOTAL_IN)}</b> a minulo <b className="text-body">{eurFull(TOTAL_OUT)}</b>;
              rozdiel išiel do rezervy. Konkrétne doklady nájdeš v registroch nižšie.
            </p>
          )}
        </div>
      </div>

      {/* ── MOBIL: vertikálny stacked tok ── */}
      <div className="lg:hidden space-y-4">
        <StackList title={`① Odkiaľ prídu · ${eurMil(TOTAL_IN)}`} items={INCOME} />
        <div className="flex justify-center"><ArrowRight className="w-5 h-5 text-muted rotate-90" aria-hidden="true" /></div>
        <div className="rounded-2xl border-2 border-emerald-500/60 bg-emerald-500/10 px-4 py-3 text-center">
          <p className="text-xs uppercase tracking-widest text-muted">Rozhoduje</p>
          <p className="font-black text-emerald-400">Mesto Martin</p>
          <p className="text-xs text-muted mt-0.5">prejde {eurMil(TOTAL_IN)}</p>
        </div>
        <div className="flex justify-center"><ArrowRight className="w-5 h-5 text-muted rotate-90" aria-hidden="true" /></div>
        <StackList title={`③ Kam idú · ${eurMil(TOTAL_OUT)} + rezerva`} items={OUTFLOW} right />
      </div>

      {/* REGISTRE — rozklik na to, čo bolo na main page */}
      <div className="mt-6 rounded-2xl border border-line bg-card/50 p-5">
        <p className="text-sm text-body font-semibold mb-1">Chceš vidieť konkrétne platby?</p>
        <p className="text-xs text-muted leading-relaxed mb-3">
          Lievik hore je rozpočet jedného roka. Konkrétne doklady sú vo viacročných registroch — tie sa{" "}
          <b className="text-body">nespočítavajú</b> s lievikom ani navzájom (objednávka → zmluva → faktúra je často tá istá platba).
        </p>
        <div className="flex flex-wrap gap-2">
          {Object.values(REGISTERS).map((r) => (
            <a key={r.href} href={r.href}
               className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-line bg-elevated/60 text-sm text-body hover:border-emerald-500/50 hover:text-emerald-400 transition-colors">
              {r.label} <span className="text-xs text-muted">({r.note})</span>
              <ExternalLink className="w-3 h-3" aria-hidden="true" />
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

function StackList({ title, items, right }: { title: string; items: FlowNode[]; right?: boolean }) {
  const router = useRouter();
  const amount = (id: string) => LINKS.filter((l) => l.source === id || l.target === id).reduce((s, l) => s + l.value, 0);
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-widest text-muted mb-2 px-1">{title}</p>
      <div className="space-y-2">
        {items.map((n) => (
          <button key={n.id} onClick={() => n.href && router.push(n.href)}
                  disabled={!n.href}
                  className={`w-full flex items-center gap-3 rounded-xl border border-line bg-card px-4 py-3 text-left ${n.href ? "cursor-pointer hover:border-emerald-500/40" : "cursor-default"}`}>
            <span className="w-3 h-3 rounded-sm shrink-0" style={{ background: n.color }} />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-body">{n.label}{n.href ? " ›" : ""}</span>
              <span className="block text-xs text-muted leading-snug">{n.hint}</span>
            </span>
            <span className="font-black text-body text-sm tabular-nums shrink-0">{eurMil(amount(n.id))}</span>
          </button>
        ))}
      </div>
      {right && <p className="sr-only">{/* layout spacer */}</p>}
    </div>
  );
}
