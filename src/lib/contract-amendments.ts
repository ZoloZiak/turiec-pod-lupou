// ─────────────────────────────────────────────────────────────────────────────
// DODATKY / KUMULATÍVNE PREPISY ZMLUVNEJ CENY (contract amendments dedup)
//
// PROBLÉM: CRZ zverejňuje každý dodatok k zmluve ako samostatný záznam a do poľa
// „Zmluvná cena" dáva NOVÚ CELKOVÚ cenu diela (nie zmenu). Náš scraper (krtko-crz)
// berie MAX sumu zo stránky → dodatok má rovnaké/vyššie číslo než pôvodná zmluva.
// Príklad — Zmluva o dielo č. 02/IO/2023 (BM-MONT):
//     Zmluva o dielo        2 558 000   ← pôvodná cena
//     Dodatok č. 5          2 685 862   ← nová CELKOVÁ cena
//     Dodatok č. 6          2 740 602
//     …
//     Dodatok č. 9          2 840 376   ← finálna cena diela
// Naivný súčet = 13,9 M €, reálna hodnota diela = 2,84 M €. Bez korekcie sa každý
// dodatok počíta znova a NAFUKUJE celkové výdavky (~26 M € = ~14 % hero čísla).
//
// RIEŠENIE: transakcie zoskupíme na „zmluvnú líniu" (ten istý dodávateľ + to isté
// číslo zmluvy + to isté jadro predmetu). V línii, kde ide o kumulatívny prepis
// ceny, ponecháme len jeden kanonický (najvyšší) záznam ako „platný" a ostatné
// označíme ako SUPERSEDED (effectiveAmount = 0). Riadok z DB nemažeme — história
// dodatkov ostáva viditeľná, len sa neráta dvakrát do súčtov.
//
// BEZPEČNOSŤ (prečo je to konzervatívne): dedup spúšťame LEN keď:
//   1. línia obsahuje aspoň jeden „Dodatok …" (bez dodatku sú to samostatné zmluvy),
//   2. nenulové sumy sú v tesnom rozpätí (min ≥ 55 % max) = kumulatívny prepis.
// Ak sumy v línii výrazne kolíšu (napr. dva roky dodávky elektriny 411k + 329k,
// alebo úver 1,67M + malý dodatok 54k), NEDEDUPUJEME — radšej mierne nafúkneme, než
// aby sme skryli reálny samostatný výdavok. Rovnako línie s rovnakým číslom zmluvy
// ale iným predmetom (Brantner ŽPaKS/03/2023: mobiliár vs zeleň vs čistenie) ostanú
// oddelené vďaka jadru predmetu v kľúči.
//
// Overené na produkčnom datasete (2129 výdavkových tx): 75 superseded riadkov,
// korekcia 31,3 M € (16,5 %). Žiadne falošné zlúčenie oddelených platieb (elektrina 2 roky,
// Park Hviezdoslava 2024 vs 2025, sociálne zmluvy OSS 12/13/14 a 48 SSD pripojení ostávajú).
// ─────────────────────────────────────────────────────────────────────────────

export interface AmendableTx {
  id: string;
  subject: string | null;
  amount_eur: number | string | null;
  supplier: { ico: string } | null;
}

const AMOUNT = (v: number | string | null | undefined): number => Number(v) || 0;

// „Dodatok …" na začiatku predmetu = záznam je dodatok (nie pôvodná zmluva).
const AMENDMENT_RE = /^\s*dodatok/i;
export function isAmendment(subject: string | null | undefined): boolean {
  return AMENDMENT_RE.test(subject || '');
}

// Zhoda čísla zmluvy: alfanum token s aspoň jedným '/' alebo '-' (napr. 02/IO/2023,
// 5/JŠ/2023, 1298/CC/23, IROP-VZ-302071BTP9-71-77) alebo dlhé čisto numerické (poistky).
const TOKEN_RE = /(?:č\.?\s*|číslo\s*)([0-9A-Za-zÀ-ž]+(?:[/\-][0-9A-Za-zÀ-ž]+){1,4})/gi;
const LONGNUM_RE = /(?:č\.?\s*|číslo\s*)([0-9]{6,}[A-Za-z0-9]*)/i;
// Sufix dodatku na čísle zmluvy: -D3, /D2 … (Dodatok č. 226/CC/18-D3 → základ 226/CC/18)
const DOD_SUFFIX_RE = /[/\-]D\d+$/i;
// Odstrihni úvodné „Dodatok č. N k/ku/o “ aby sme nechytili číslo dodatku miesto zmluvy.
const AMEND_PREFIX_RE = /^\s*dodatok\s*(č\.?|číslo)?\s*[0-9]+[./]?[0-9A-Za-z-]*\s*(k|ku|o)\s+/i;

// OCR/prepis normalizácia čísla zmluvy: rovnaká zmluva býva zapísaná raz s písmenami,
// raz s číslicami (Zmluva o dielo č. 02/10/2023 vs Dodatok č. 02/IO/2023 — tá istá stavba
// BM-MONT). Zjednotíme vizuálne zameniteľné znaky: O→0, I→1, L→1. Bezpečné, lebo kľúč
// zoskupenia navyše obsahuje IČO dodávateľa aj jadro predmetu — samotné foldnutie čísla
// nemôže zliať dve reálne rôzne zmluvy.
function ocrFold(tok: string): string {
  return tok.toUpperCase().replace(/O/g, '0').replace(/[IL]/g, '1');
}

export function baseContractNo(subject: string | null | undefined): string | null {
  const s = subject || '';
  const stripped = s.replace(AMEND_PREFIX_RE, '');
  const pick = (txt: string): string | null => {
    const matches = [...txt.matchAll(TOKEN_RE)].map((m) => m[1]);
    if (matches.length === 0) return null;
    // najdlhší token = najpravdepodobnejšie plné číslo zmluvy
    const tok = matches.reduce((a, b) => (b.length > a.length ? b : a));
    return ocrFold(tok.replace(/\s/g, '').replace(DOD_SUFFIX_RE, ''));
  };
  const fromStripped = pick(stripped);
  if (fromStripped) return fromStripped;
  const fromFull = pick(s);
  if (fromFull) return fromFull;
  const m = s.match(LONGNUM_RE);
  return m ? ocrFold(m[1]) : null;
}

// Jadro predmetu (bez slov zmluva/dodatok/dohoda, čísel a diakritiky) — rozlíši
// dve rôzne zmluvy s rovnakým číslom (mobiliár vs zeleň vs čistenie u Brantnera).
export function subjectCore(subject: string | null | undefined): string {
  let s = subject || '';
  s = s.replace(/\bdodatok\b.*?\bk\s+/gi, '');
  s = s.replace(/\bzmluv\w+\b|\bdohod\w+\b|\bdodat\w*\b/gi, ' ');
  s = s.replace(/č\.?\s*[0-9A-Za-zÀ-ž/-]+/gi, ' ');
  s = s.replace(/[0-9]/g, ' ');
  s = s.normalize('NFKD').replace(/[\u0300-\u036f]/g, ''); // strip diakritiku
  s = s.toLowerCase().replace(/[^a-z ]/g, ' ');
  const toks = Array.from(new Set(s.split(/\s+/).filter((w) => w.length > 3))).sort();
  return toks.slice(0, 6).join(' ');
}

// Generické stavebné/služobné slová — samy o sebe nič neidentifikujú, preto ich pri
// token-overlap zhode (STAGE 2) vynechávame, aby „stavebné úpravy budovy Martin“ nespojilo
// dve nesúvisiace stavby. Overlap musí sedieť na DISTINKTÍVNYCH slovách (názvy ulíc, objektov).
const CORE_STOPWORDS = new Set([
  'stavby', 'stavba', 'realizacia', 'stavebne', 'upravy', 'budovy', 'budova',
  'sluzieb', 'sluzby', 'dielo', 'dielu', 'martin', 'mesta', 'meste', 'mesto',
]);

// Množina distinktívnych tokenov predmetu (pre token-overlap absorpciu no-number záznamov).
export function coreTokens(subject: string | null | undefined): Set<string> {
  let s = subject || '';
  s = s.replace(/\bdodatok\b.*?\bk\s+/gi, '');
  s = s.replace(/\bzmluv\w+\b|\bdohod\w+\b|\bdodat\w*\b/gi, ' ');
  s = s.replace(/č\.?\s*[0-9A-Za-zÀ-ž/-]+/gi, ' ');
  s = s.replace(/[0-9]/g, ' ');
  s = s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  s = s.toLowerCase().replace(/[^a-z ]/g, ' ');
  return new Set(s.split(/\s+/).filter((w) => w.length > 3 && !CORE_STOPWORDS.has(w)));
}

function intersectSize(a: Set<string>, b: Set<string>): number {
  let n = 0;
  for (const x of a) if (b.has(x)) n++;
  return n;
}

function groupKey(t: AmendableTx): string | null {
  const sup = t.supplier?.ico;
  const bc = baseContractNo(t.subject);
  if (!sup || !bc) return null;
  return `${sup}|${bc}|${subjectCore(t.subject)}`;
}

// V línii dedupujeme len keď ide o kumulatívny prepis ceny (nie oddelené platby).
function shouldDedup(group: AmendableTx[]): boolean {
  if (!group.some((t) => isAmendment(t.subject))) return false; // bez dodatku = samostatné zmluvy
  const nz = group.map((t) => AMOUNT(t.amount_eur)).filter((a) => a > 0);
  if (nz.length < 2) return nz.length >= 1; // 1 nenulový + nulové dodatky → dedup (bezpečné)
  const hi = Math.max(...nz);
  const lo = Math.min(...nz);
  return lo >= hi * 0.55; // tesné rozpätie = prepis tej istej ceny; inak nechaj (konzervatívne)
}

export interface AmendmentResult {
  // ID záznamov, ktoré sú superseded (starší/nižší dodatok tej istej ceny) → nerátať.
  supersededIds: Set<string>;
}

// Jediný vstupný bod: z poľa transakcií vypočíta množinu superseded ID. Volá sa
// v /api/data aj /api/supplier nad tým istým (deduplikovaným) zoznamom transakcií.
//
// STAGE 1: zoskup záznamy s rozpoznaným číslom zmluvy podľa (IČO | číslo | jadro predmetu).
// STAGE 2: záznam BEZ čísla zmluvy (scraper ho v predmete nezachytil) skús priradiť k práve
//   jednej existujúcej číslovanej skupine toho istého dodávateľa, ak zdieľajú ≥3 distinktívne
//   slová predmetu A suma zapadá do cenovej reťaze skupiny [0.55·max … 1.05·max]. Napr.
//   BM-MONT „Stavebné úpravy … A. Pietra – 48 nájomných bytov“ (bez čísla, 2 620 353 €)
//   patrí k stavbe 02/IO/2023 (dodatky 2 558 000 … 2 840 376). Jednoznačnosť (práve 1 cieľ)
//   + suma-fit + distinktívny overlap bránia falošnému priradeniu.
// STAGE 3: v každej línii, kde ide o kumulatívny prepis ceny, ponechaj len najvyšší záznam.
export function computeAmendmentSupersessions(txs: AmendableTx[]): AmendmentResult {
  // STAGE 1 — číslované skupiny
  const groups = new Map<string, AmendableTx[]>();
  const noNumber: AmendableTx[] = [];
  for (const t of txs) {
    const k = groupKey(t);
    if (k) {
      const arr = groups.get(k);
      if (arr) arr.push(t);
      else groups.set(k, [t]);
    } else if (t.supplier?.ico) {
      noNumber.push(t); // má dodávateľa, ale číslo zmluvy sa nerozpoznalo
    }
  }

  // Predpočítaj distinktívne tokeny a max sumu pre každú skupinu s aspoň jedným dodatkom.
  const groupMeta = new Map<string, { ico: string; tokens: Set<string>; hi: number }>();
  for (const [k, v] of groups) {
    if (!v.some((t) => isAmendment(t.subject))) continue;
    const ico = k.split('|')[0];
    const tokens = new Set<string>();
    let hi = 0;
    for (const t of v) {
      for (const tok of coreTokens(t.subject)) tokens.add(tok);
      const a = AMOUNT(t.amount_eur);
      if (a > hi) hi = a;
    }
    if (hi > 0) groupMeta.set(k, { ico, tokens, hi });
  }

  // STAGE 2 — absorbuj no-number záznamy do jednoznačnej cieľovej skupiny
  for (const t of noNumber) {
    const ico = t.supplier!.ico;
    const ct = coreTokens(t.subject);
    if (ct.size < 3) continue;
    const amt = AMOUNT(t.amount_eur);
    if (amt <= 0) continue; // nulové no-number nemá zmysel absorbovať (neovplyvní súčet)
    let match: string | null = null;
    let ambiguous = false;
    for (const [k, meta] of groupMeta) {
      if (meta.ico !== ico) continue;
      if (intersectSize(ct, meta.tokens) < 3) continue;
      if (amt < meta.hi * 0.55 || amt > meta.hi * 1.05) continue; // suma musí zapadať do reťaze
      if (match) { ambiguous = true; break; }
      match = k;
    }
    if (match && !ambiguous) groups.get(match)!.push(t);
  }

  // STAGE 3 — supersession v každej línii
  const supersededIds = new Set<string>();
  for (const group of groups.values()) {
    if (group.length < 2 || !shouldDedup(group)) continue;
    // kanonický = najvyššia suma (finálna cena diela); pri zhode prvý
    let canonical = group[0];
    for (const t of group) {
      if (AMOUNT(t.amount_eur) > AMOUNT(canonical.amount_eur)) canonical = t;
    }
    for (const t of group) {
      if (t.id !== canonical.id) supersededIds.add(t.id);
    }
  }
  return { supersededIds };
}

// Pomocník: efektívna (rátaná) suma transakcie — 0 pre superseded, inak pôvodná.
export function effectiveAmount(
  t: { id: string; amount_eur: number | string | null },
  superseded: Set<string>
): number {
  return superseded.has(t.id) ? 0 : AMOUNT(t.amount_eur);
}
