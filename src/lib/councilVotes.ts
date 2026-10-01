// Zdielany dekoder kompaktneho zaznamu hlasovani MsZ (public/data/council-votes.json).
// Format je kompaktny (33 poslancov indexovanych raz, kazde hlasovanie = 33-znakovy kod),
// aby cela historia (750+ hlasovani) mala ~220 KB namiesto ~10 MB. Zdroj: martin.sk H.E.R.

export type VoteCast = "ZA" | "PROTI" | "ZDRŽAL SA" | "NEPRÍTOMNÝ" | "NEHLASOVAL" | "—";

const CODE_MAP: Record<string, VoteCast> = {
  Z: "ZA", P: "PROTI", D: "ZDRŽAL SA", N: "NEPRÍTOMNÝ", H: "NEHLASOVAL", ".": "—",
};

export type RawVoting = {
  d: string;        // datum zasadnutia YYYY-MM-DD
  n: number | null; // poradove cislo hlasovania v ten den
  u: string | null; // cislo uznesenia
  t: string;        // nazov bodu
  za: number; proti: number; zdrzal: number; nepr: number; nehl: number;
  s: string;        // source URL (martin.sk)
  c: string;        // 33-znakovy kod hlasov (poradie = councillors[])
  p?: number;       // zakonny verdikt: 1 preslo / 0 nepreslo (369/1990 Zb.)
  pr?: number;      // pocet pritomnych v sale (ZA+PROTI+zdrzal+nehlasoval)
  nd?: number;      // potrebne ZA na schvalenie (kvorum z pritomnych)
  rl?: string;      // pouzite pravidlo: "vzn_3_5" | "nadpolovicna"
};

export type CouncilData = {
  councillors: string[];
  votings: RawVoting[];
  meta: { seats: number; range: [string, string]; voting_count: number };
};

export type CouncillorVote = { name: string; cast: VoteCast };

export type Voting = {
  key: string;
  date: string;
  votingNo: number | null;
  resolution: string | null;
  title: string;
  za: number; proti: number; zdrzal: number; nepr: number; nehl: number;
  contested: number;          // proti + zdrzal (miera spornosti)
  passed: boolean | null;     // zakonny verdikt preslo/nepreslo (null ak sa nehlasovalo)
  present: number | null;     // pocet pritomnych v sale
  needed: number | null;      // potrebne ZA na schvalenie (kvorum z pritomnych)
  rule: "vzn_3_5" | "nadpolovicna" | null;  // pouzite kvorum
  source: string;
  rows: CouncillorVote[];     // dekodovane, len poslanci co v hlasovani figurovali
};

// Dekoduj jedno hlasovanie z kompaktneho formatu.
export function decodeVoting(raw: RawVoting, councillors: string[]): Voting {
  const rows: CouncillorVote[] = [];
  for (let i = 0; i < councillors.length; i++) {
    const cast = CODE_MAP[raw.c[i]] ?? "—";
    if (cast !== "—") rows.push({ name: councillors[i], cast });
  }
  return {
    key: `${raw.d}#${raw.n ?? 0}#${raw.u ?? ""}`,
    date: raw.d,
    votingNo: raw.n,
    resolution: raw.u,
    title: raw.t,
    za: raw.za, proti: raw.proti, zdrzal: raw.zdrzal, nepr: raw.nepr, nehl: raw.nehl,
    contested: raw.proti + raw.zdrzal,
    passed: raw.p === undefined ? null : raw.p === 1,
    present: raw.pr ?? null,
    needed: raw.nd ?? null,
    rule: (raw.rl as Voting["rule"]) ?? null,
    source: raw.s,
    rows,
  };
}

export function decodeAll(data: CouncilData): Voting[] {
  return data.votings.map((v) => decodeVoting(v, data.councillors));
}

export function voteClass(v: VoteCast): string {
  if (v === "ZA") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300";
  if (v === "PROTI") return "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300";
  if (v === "ZDRŽAL SA") return "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300";
  return "bg-elevated text-muted";
}

export const VOTE_ORDER: VoteCast[] = ["ZA", "PROTI", "ZDRŽAL SA", "NEHLASOVAL", "NEPRÍTOMNÝ"];

// ─────────────────────────────────────────────────────────────────────────
// ANALÝZA VZOROV — všetko počítané z kompaktného kódu (Z/P/D/N/H/.), bez
// predpočítaného súboru. Spúšťa sa v prehliadači (useMemo) nad celým datasetom,
// takže keď ETL pridá nové zasadnutie, čísla sa prepočítajú samy.
//
// Metodika (zámerne jednoduchá a vysvetliteľná laikovi):
//  - "aktívny hlas" = iba ZA/PROTI (Z/P). Zdržal sa / neprítomný / nehlasoval
//    sa do zhody NErátajú (nie je to jasný postoj za/proti).
//  - Koaličný blok sa DETEGUJE, nie zadáva: začne najvernejšou dvojicou a
//    priberá každého, kto má ≥97 % zhodu so VŠETKÝMI členmi bloku.

export type Group = "jadro" | "opozicia" | "swing";

export type CircleNode = {
  name: string;
  group: Group;
  coreAlign: number;   // % zhody s jadrom na SPORNÝCH hlasovaniach (0–100)
  activeCount: number;
};

export type CircleEdge = { a: number; b: number; w: number }; // index do circle.nodes, w = zhoda 0–1

export type SwingRow = { name: string; corePct: number; oppPct: number };

export type AttRow = { name: string; presentPct: number; present: number; member: number; fullAbsent: number };

// Hlasovanie, ktoré podľa zákona 369/1990 NEPREŠLO (p===0). Vrátane menného
// zoznamu "proti" a "zdržal" — laik vidí, kto návrh nepodporil.
export type FailedVote = {
  date: string;
  resolution: string | null;
  title: string;
  za: number; proti: number; zdrzal: number;
  present: number; needed: number; missing: number;  // koľko ZA chýbalo do kvóra
  rule: "vzn_3_5" | "nadpolovicna" | null;
  againstNames: string[];   // kto hlasoval PROTI
  abstainNames: string[];   // kto sa zdržal
  source: string;
};

export type Analysis = {
  totalVotings: number;
  contestedVotings: number;      // hlasovania, kde menšina ≥ 20 %
  unanimousShare: number;        // podiel hlasovaní, kde bola zhoda ≥95 %
  blocSize: number;              // veľkosť koaličného jadra (finálne zaradenie)
  oppSize: number;               // veľkosť opozičného tábora (finálne zaradenie)
  swingSize: number;             // počet lavírujúcich
  circle: { nodes: CircleNode[]; edges: CircleEdge[] };
  swing: SwingRow[];             // kto lavíruje medzi tábormi
  attendance: AttRow[];          // účasť na hlasovaniach
  failed: FailedVote[];          // hlasovania, ktoré podľa zákona neprešli
};

const AY = (ch: string): "ZA" | "PROTI" | null =>
  ch === "Z" ? "ZA" : ch === "P" ? "PROTI" : null;

// Je hlasovanie sporné? (menšina aspoň 20 % z jasných hlasov za/proti)
function isContested(c: string): boolean {
  let za = 0, proti = 0;
  for (let i = 0; i < c.length; i++) { if (c[i] === "Z") za++; else if (c[i] === "P") proti++; }
  const at = za + proti;
  return at > 0 && Math.max(za, proti) / at < 0.8;
}

export function analyze(data: CouncilData, minActive = 150): Analysis {
  const C = data.councillors;
  const N = C.length;
  const V = data.votings;

  // ── zhoda dvojíc: zvlášť na VŠETKÝCH a zvlášť na SPORNÝCH hlasovaniach ──
  const agreeAll = new Map<string, number>();
  const togAll = new Map<string, number>();
  const agreeCon = new Map<string, number>();
  const togCon = new Map<string, number>();
  const bump = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);

  const active = new Array(N).fill(0);   // počet jasných hlasov Z/P
  const present = new Array(N).fill(0);
  const member = new Array(N).fill(0);
  const fullAbsent = new Array(N).fill(0); // koľko zasadnutí celkom chýbal
  let unanimous = 0;
  let contestedVotings = 0;

  // zoskup hlasovania podľa dátumu kvôli "celá absencia na zasadnutí"
  const byDate = new Map<string, RawVoting[]>();
  for (const v of V) {
    const arr = byDate.get(v.d); if (arr) arr.push(v); else byDate.set(v.d, [v]);
  }

  for (const v of V) {
    const c = v.c;
    let za = 0, proti = 0;
    for (let i = 0; i < N; i++) {
      const ch = c[i];
      if (ch !== ".") { member[i]++; if (ch !== "N") present[i]++; }
      if (ch === "Z") za++; else if (ch === "P") proti++;
    }
    const at = za + proti;
    if (at > 0 && Math.max(za, proti) / at >= 0.95) unanimous++;
    const contested = isContested(c);
    if (contested) contestedVotings++;

    const act: number[] = [];
    for (let i = 0; i < N; i++) if (AY(c[i])) { act.push(i); active[i]++; }
    for (let x = 0; x < act.length; x++) {
      for (let y = x + 1; y < act.length; y++) {
        const i = act[x], j = act[y];
        const k = `${i}-${j}`;
        bump(togAll, k);
        if (c[i] === c[j]) bump(agreeAll, k);
        if (contested) { bump(togCon, k); if (c[i] === c[j]) bump(agreeCon, k); }
      }
    }
  }

  // celé absencie: na zasadnutí mal člen aspoň 1 nie-"." kód, ale 0 prítomných (všetko N)
  for (const [, arr] of byDate) {
    for (let i = 0; i < N; i++) {
      let memberHere = false, presentHere = false;
      for (const v of arr) { const ch = v.c[i]; if (ch !== ".") { memberHere = true; if (ch !== "N") presentHere = true; } }
      if (memberHere && !presentHere) fullAbsent[i]++;
    }
  }

  const pairPctAll = (i: number, j: number): number | null => {
    const k = i < j ? `${i}-${j}` : `${j}-${i}`;
    const t = togAll.get(k) ?? 0;
    return t >= 80 ? (agreeAll.get(k) ?? 0) / t : null;
  };
  const pairPctCon = (i: number, j: number): number | null => {
    const k = i < j ? `${i}-${j}` : `${j}-${i}`;
    const t = togCon.get(k) ?? 0;
    return t >= 15 ? (agreeCon.get(k) ?? 0) / t : null;
  };

  // ── detekcia jadra: seed = najvernejšia dvojica (≥300 spol.), priber ≥97 % ──
  const growBloc = (pool: number[]): number[] => {
    let seed: [number, number] | null = null, sp = 0;
    for (let a = 0; a < pool.length; a++) for (let b = a + 1; b < pool.length; b++) {
      const i = pool[a], j = pool[b];
      const k = i < j ? `${i}-${j}` : `${j}-${i}`;
      const t = togAll.get(k) ?? 0;
      if (t >= 300) { const p = (agreeAll.get(k) ?? 0) / t; if (p > sp) { sp = p; seed = [i, j]; } }
    }
    if (!seed) return [];
    const b = [...seed];
    let changed = true;
    while (changed) {
      changed = false;
      for (const cand of pool) {
        if (b.includes(cand)) continue;
        if (b.every((m) => { const p = pairPctAll(cand, m); return p !== null && p >= 0.97; })) { b.push(cand); changed = true; }
      }
    }
    return b;
  };

  const activeIdx = Array.from({ length: N }, (_, i) => i).filter((i) => active[i] >= minActive);
  const bloc = growBloc(activeIdx);
  const blocSet = new Set(bloc);
  const rest = activeIdx.filter((i) => !blocSet.has(i));
  const opp = growBloc(rest);           // druhý tábor = najvernejší blok vo zvyšku
  const oppSet = new Set(opp);

  // ── zarovnanie každého aktívneho poslanca na SPORNÝCH hlasovaniach ──
  // coreAlign = priemerná zhoda s členmi jadra; oppAlign = s členmi opozície
  const avgCon = (i: number, group: number[]): number | null => {
    const vals: number[] = [];
    for (const m of group) { if (m === i) continue; const p = pairPctCon(i, m); if (p !== null) vals.push(p); }
    return vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length) : null;
  };

  const nodes: CircleNode[] = [];
  const swing: SwingRow[] = [];
  for (const i of activeIdx) {
    const core = avgCon(i, bloc);
    const oppa = avgCon(i, opp);
    const coreAlign = core === null ? 50 : core * 100;
    let group: Group;
    if (blocSet.has(i)) group = "jadro";
    else if (oppSet.has(i)) group = "opozicia";
    else {
      // nezaradení: podľa zarovnania na sporných
      if (core !== null && oppa !== null) {
        if (core >= 0.65 && core - oppa > 0.25) group = "jadro";
        else if (oppa >= 0.65 && oppa - core > 0.25) group = "opozicia";
        else group = "swing";
      } else group = "swing";
    }
    nodes.push({ name: C[i], group, coreAlign, activeCount: active[i] });
    if (group === "swing" && core !== null && oppa !== null)
      swing.push({ name: C[i], corePct: core * 100, oppPct: oppa * 100 });
  }

  // zoraď uzly podľa zarovnania s jadrom (jadro → swing → opozícia) pre pekný kruh
  nodes.sort((a, b) => b.coreAlign - a.coreAlign);
  const idxOf = new Map(nodes.map((n, k) => [n.name, k]));

  // ── hrany kruhu: zhoda na SPORNÝCH ≥ 80 % (min 15 spol.) ──
  const edges: CircleEdge[] = [];
  for (let a = 0; a < nodes.length; a++) {
    for (let b = a + 1; b < nodes.length; b++) {
      const i = C.indexOf(nodes[a].name), j = C.indexOf(nodes[b].name);
      const p = pairPctCon(i, j);
      if (p !== null && p >= 0.8) edges.push({ a, b, w: p });
    }
  }
  void idxOf;

  swing.sort((a, b) => b.corePct - a.corePct);

  // finálne počty táborov podľa zaradenia uzlov (nie seed detekcie)
  let nJadro = 0, nOpoz = 0, nSwing = 0;
  for (const n of nodes) {
    if (n.group === "jadro") nJadro++;
    else if (n.group === "opozicia") nOpoz++;
    else nSwing++;
  }

  const attendance: AttRow[] = [];
  for (let i = 0; i < N; i++) {
    if (member[i] >= minActive)
      attendance.push({ name: C[i], presentPct: (100 * present[i]) / member[i], present: present[i], member: member[i], fullAbsent: fullAbsent[i] });
  }
  attendance.sort((a, b) => b.presentPct - a.presentPct);

  // ── hlasovania, ktoré podľa zákona NEPREŠLI (p===0) ──
  // Verdikt je predpočítaný v ETL (kvórum z prítomných, 369/1990). Tu len
  // doplníme menné zoznamy proti/zdržal, aby laik videl, kto návrh nepodporil.
  const failed: FailedVote[] = [];
  for (const v of V) {
    if (v.p !== 0) continue;
    const againstNames: string[] = [];
    const abstainNames: string[] = [];
    for (let i = 0; i < N; i++) {
      if (v.c[i] === "P") againstNames.push(C[i]);
      else if (v.c[i] === "D") abstainNames.push(C[i]);
    }
    const needed = v.nd ?? 0;
    failed.push({
      date: v.d, resolution: v.u, title: v.t,
      za: v.za, proti: v.proti, zdrzal: v.zdrzal,
      present: v.pr ?? (v.za + v.proti + v.zdrzal + v.nehl),
      needed, missing: Math.max(0, needed - v.za),
      rule: (v.rl as FailedVote["rule"]) ?? null,
      againstNames, abstainNames, source: v.s,
    });
  }
  failed.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  return {
    totalVotings: V.length,
    contestedVotings,
    unanimousShare: (100 * unanimous) / V.length,
    blocSize: nJadro,
    oppSize: nOpoz,
    swingSize: nSwing,
    circle: { nodes, edges },
    swing,
    attendance,
    failed,
  };
}
