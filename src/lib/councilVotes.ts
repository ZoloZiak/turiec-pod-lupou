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
