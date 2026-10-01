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

export type Analysis = {
  totalVotings: number;
  unanimousShare: number;        // podiel hlasovaní, kde bola zhoda ≥95 %
  bloc: string[];                // mená koaličného jadra (detegované)
  opposition: OppRow[];          // kto najčastejšie proti väčšine
  pairs: PairRow[];              // najvernejšie dvojice
  defectors: OppRow[];           // kto najčastejšie hlasuje inak než blok
  attendance: AttRow[];          // účasť na hlasovaniach
};

export type OppRow = { name: string; pct: number; count: number; total: number };
export type PairRow = { a: string; b: string; pct: number; total: number };
export type AttRow = { name: string; presentPct: number; present: number; member: number };

const AY = (ch: string): "ZA" | "PROTI" | null =>
  ch === "Z" ? "ZA" : ch === "P" ? "PROTI" : null;

export function analyze(data: CouncilData, minActive = 100): Analysis {
  const C = data.councillors;
  const N = C.length;
  const V = data.votings;

  // párová zhoda (len na hlasovaniach kde oba Z/P)
  const agree = new Map<string, number>();
  const together = new Map<string, number>();
  const bump = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);

  // opozícia proti víťaznej strane + účasť + jednomyseľnosť
  const against = new Array(N).fill(0);
  const active = new Array(N).fill(0);
  const present = new Array(N).fill(0);
  const member = new Array(N).fill(0);
  let unanimous = 0;

  for (const v of V) {
    const c = v.c;
    let za = 0, proti = 0;
    for (let i = 0; i < N; i++) {
      const ch = c[i];
      if (ch !== ".") {
        member[i]++;
        if (ch !== "N") present[i]++;
      }
      if (ch === "Z") za++;
      else if (ch === "P") proti++;
    }
    const activeTotal = za + proti;
    if (activeTotal > 0 && Math.max(za, proti) / activeTotal >= 0.95) unanimous++;

    if (za !== proti && activeTotal > 0) {
      const winner = za > proti ? "Z" : "P";
      for (let i = 0; i < N; i++) {
        const a = AY(c[i]);
        if (a) {
          active[i]++;
          if (c[i] !== winner) against[i]++;
        }
      }
    }
    // páry
    const act: number[] = [];
    for (let i = 0; i < N; i++) if (AY(c[i])) act.push(i);
    for (let x = 0; x < act.length; x++) {
      for (let y = x + 1; y < act.length; y++) {
        const i = act[x], j = act[y];
        const k = `${i}-${j}`;
        bump(together, k);
        if (c[i] === c[j]) bump(agree, k);
      }
    }
  }

  const pairPct = (i: number, j: number): number | null => {
    const k = i < j ? `${i}-${j}` : `${j}-${i}`;
    const t = together.get(k) ?? 0;
    return t >= 80 ? (agree.get(k) ?? 0) / t : null;
  };

  // detekcia bloku: seed = najvernejšia dvojica (≥300 spoločných), priber ≥97 %
  let seedPair: [number, number] | null = null;
  let seedPct = 0;
  for (const [k, t] of together) {
    if (t >= 300) {
      const p = (agree.get(k) ?? 0) / t;
      if (p > seedPct) { seedPct = p; const [i, j] = k.split("-").map(Number); seedPair = [i, j]; }
    }
  }
  const bloc: number[] = seedPair ? [...seedPair] : [];
  let changed = true;
  const TH = 0.97;
  while (changed) {
    changed = false;
    for (let cand = 0; cand < N; cand++) {
      if (bloc.includes(cand)) continue;
      if (bloc.every((m) => { const p = pairPct(cand, m); return p !== null && p >= TH; })) {
        bloc.push(cand); changed = true;
      }
    }
  }
  const blocSet = new Set(bloc);

  // kto hlasuje inak než blok (defectors) — len mimo bloku, min aktívnych
  const defect = new Array(N).fill(0);
  const defTotal = new Array(N).fill(0);
  for (const v of V) {
    const c = v.c;
    let bz = 0, bp = 0;
    for (const m of bloc) { const a = AY(c[m]); if (a === "ZA") bz++; else if (a === "PROTI") bp++; }
    if (bz + bp < 4) continue;
    const stance = bz >= bp ? "Z" : "P";
    for (let i = 0; i < N; i++) {
      if (blocSet.has(i)) continue;
      const a = AY(c[i]);
      if (a) { defTotal[i]++; if (c[i] !== stance) defect[i]++; }
    }
  }

  const opposition: OppRow[] = [];
  const defectors: OppRow[] = [];
  const attendance: AttRow[] = [];
  for (let i = 0; i < N; i++) {
    if (active[i] >= minActive)
      opposition.push({ name: C[i], pct: (100 * against[i]) / active[i], count: against[i], total: active[i] });
    if (defTotal[i] >= minActive)
      defectors.push({ name: C[i], pct: (100 * defect[i]) / defTotal[i], count: defect[i], total: defTotal[i] });
    if (member[i] >= minActive)
      attendance.push({ name: C[i], presentPct: (100 * present[i]) / member[i], present: present[i], member: member[i] });
  }
  opposition.sort((a, b) => b.pct - a.pct);
  defectors.sort((a, b) => b.pct - a.pct);
  attendance.sort((a, b) => b.presentPct - a.presentPct);

  const pairs: PairRow[] = [];
  for (const [k, t] of together) {
    if (t >= 150) {
      const [i, j] = k.split("-").map(Number);
      pairs.push({ a: C[i], b: C[j], pct: (100 * (agree.get(k) ?? 0)) / t, total: t });
    }
  }
  pairs.sort((a, b) => b.pct - a.pct);

  return {
    totalVotings: V.length,
    unanimousShare: (100 * unanimous) / V.length,
    bloc: bloc.map((i) => C[i]).sort((a, b) => a.localeCompare(b, "sk")),
    opposition,
    pairs,
    defectors,
    attendance,
  };
}
