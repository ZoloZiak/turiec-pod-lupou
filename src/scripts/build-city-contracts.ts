/**
 * build-city-contracts.ts — PREHLIADATEĽNÉ zmluvy mesta Martin (egov CORA, NavigationState=778).
 *
 * CIEĽ: doteraz boli zmluvy mesta len audit-pomôcka (supplier-contracts.json = set IČO so
 * zmluvou). Občan si zmluvu na webe nevedel pozrieť. Toto z nich robí plnohodnotné
 * prehliadateľné záznamy (typ, strany, predmet, suma, dátum) s hľadaním a filtrom.
 *
 * ZDROJ: open-data JSON export 778 (plac1889:_144101_5_8, 13 MB, 30 514 zmlúv od 2010). BEZ IČO
 * (portál ho pri zmluvách nezverejňuje — párovanie na meno je inde).
 *
 * GDPR / ZMYSEL — čo VYNECHÁVAME:
 *  - Nájmy hrobových miest (~10 238): mená občanov (fyzické osoby), sú to PRÍJMY mesta
 *    (občan platí za hrob), nie výdavky. Masové zverejnenie 10k mien = amplifikácia osobných
 *    údajov, ktorú transparentný web robiť nemá. Portál ich má; my ich do výberu neťaháme.
 *  Ostatné zmluvy sú legitímna transparentnosť hospodárenia (mesto ich už zverejňuje verejne).
 *
 * ŠKÁLOVANIE: 20k zmlúv = ~6 MB. NEbundlujeme do klienta (zabil by web + serverless limit).
 *  - public/data/city-contracts.json — celý prehliadateľný set (lazy fetch, Vercel gzipne ~1 MB,
 *    klient stránkuje). NIE static import.
 *  - src/data/city-contract-stats.json — malé agregáty (count, byYear, byType, big) pre prehľad.
 *
 * HODNOTA: NErobíme headline súčet € (dodatky recyklujú cenu = data-pasca; hero totalSpent
 *  ostáva CRZ). Zobrazujeme počty + sumu per zmluva. Dodatky značíme typom.
 *
 * Spustenie: npm run build:contracts  (env CONTRACTS_JSON=/cesta na lokálny export)
 */
import { resolve } from 'path';
import { writeFileSync, existsSync, readFileSync, mkdirSync } from 'fs';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const EXPORT_URL = 'https://egov.martin.sk/Default.aspx?NavigationState=778:0::plac1889:_144101_5_8';
const SOURCE_URL = 'https://egov.martin.sk/Default.aspx?NavigationState=778:0:';
const BIG = 10000;

interface Raw {
  'Centrálne_číslo_zmluvy'?: string; 'Rok'?: string; 'Typ'?: string; 'Druh'?: string;
  'Zmluvné_strany'?: string; 'Predmet'?: string; 'Cena_celkom'?: string; 'Mena'?: string;
  'Dátum_podpisu'?: string; 'Dátum_zverejnenia'?: string;
}

function parseEur(s: string): number {
  const c = (s || '').replace(/\u00a0/g, '').replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
  const n = parseFloat(c);
  return Number.isFinite(n) ? n : 0;
}
function isGrave(r: Raw): boolean {
  return /hrobov/i.test(`${r['Druh'] || ''} ${r['Predmet'] || ''} ${r['Typ'] || ''}`);
}
function cleanParties(s: string): string {
  return (s || '').replace(/\r/g, ' / ').replace(/\s+/g, ' ').trim();
}

// ---- GDPR anonymizácia fyzických osôb (možnosť 2: skry meno FO, firmy/inštitúcie nechaj) ----
// Zmluvy mesta s občanmi (výpožičky pozemkov, nájmy, dohody) sú zákonne verejné, ale robiť ich
// vyhľadávateľnými amplifikuje osobné údaje. Meno FO -> "Fyzická osoba"; suma/predmet/typ ostávajú
// (transparentnosť hospodárenia zachovaná). Firmy, živnostníkov a inštitúcie NEanonymizujeme.
// Detektor overený na reálnych dátach: 0 organizácií falošne anonymizovaných (kontrola oboma smermi).
const ORG_RE = /s\.?\s?r\.?\s?o|\ba\.?\s?s\b|spol\.|akciov|\bš\.?\s?p\b|\bo\.?\s?z\b|\bn\.?\s?o\b|\bk\.?\s?s\b|\bv\.?\s?o\.?\s?s\b|družstv|obec\b|\bmesto\b|\bobce\b|úrad|štát|banka|poisťov|univerzit|nemocnic|\bZŠ\b|\bMŠ\b|\bSŠ\b|\bSOŠ\b|centrum|spoločnos|ministerstv|\bklub\b|združen|nadácia|cirkev|diakon|\bškola\b|školy|akadém|komora|zväz|inštitút|\bfond\b|s\. r\. o|a\. s\.|gymnáz|správa|slovensk|republik|kraj\b|samosprávny|jednota|zariadenie|domov|\bSVB\b|vlastníkov|telovýchov|telocvičn|futbal|hokej|\bTJ\b|\bŠK\b|\bMFK\b|orol|skaut|charita|verejn|agentúra|rozhlas|televíz|pošta|dráhy|železnic|lesy|vodárne|teplo|\bSPP\b|\bZSE\b|\bSSE\b|energ|plyn|spol[oe]k|spolku|obč[ei]anske|sdružení|klaster|aliancia|\bliga\b|federáci|kancelária|advokát|salón|salon|servis|autoškola|lekáre|ambulanc|s\.p\.|obchodná|obchodné|galéri|múze|divadlo|knižnic|stredisko|rada\b|výbor|zbor|organizácia|múze/i;
const DASH_BIZ_RE = /\s[-–]\s/;
const ALLCAPS_RE = /\b[A-ZÁÄČĎÉÍĹĽŇÓÔŔŠŤÚÝŽ]{3,}\b/;
const TITLES = new Set(['ing.', 'mgr.', 'bc.', 'judr.', 'mudr.', 'phdr.', 'rndr.', 'doc.', 'prof.', 'ing', 'mgr', 'bc', 'dr.', 'paeddr.', 'mvdr.', 'phd.', 'art.', 'csc.']);

function partyIsPerson(sp: string): boolean {
  if (!sp) return false;
  if (/^fyzick[áa] osoba/i.test(sp)) return false; // už anonymizované portálom
  if (ORG_RE.test(sp)) return false;
  if (DASH_BIZ_RE.test(sp)) return false;          // živnostník "Meno - Firma"
  if (/\d/.test(sp)) return false;                 // čísla = IČO/názov
  if (ALLCAPS_RE.test(sp)) return false;           // obchodný názov živnostníka
  const namewords = sp.replace(/,/g, '').split(/\s+/).filter(w => w && !TITLES.has(w.toLowerCase()));
  if (namewords.length < 2 || namewords.length > 4) return false;
  return namewords.every(w => w[0] === w[0].toUpperCase());
}

// Anonymizuj FO strany v texte "Mesto Martin / Meno Priezvisko". Mesto a org časti nechaj.
function anonymizeParties(strany: string): string {
  const parts = strany.split(/\s*\/\s*/).map(p => p.trim()).filter(Boolean);
  return parts.map(p => {
    if (/mesto martin|útvar hlavného|mestský úrad/i.test(p)) return p;
    return partyIsPerson(p) ? 'Fyzická osoba' : p;
  }).join(' / ');
}

async function loadExport(): Promise<Raw[]> {
  const localPath = process.env.CONTRACTS_JSON || resolve(process.env.TMPDIR || '/tmp', 'zmluvy.json');
  if (existsSync(localPath)) {
    console.log(`  z lokálneho súboru: ${localPath}`);
    return JSON.parse(readFileSync(localPath, 'utf-8')) as Raw[];
  }
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(EXPORT_URL, { redirect: 'follow' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json() as Raw[];
    } catch (e) {
      console.log(`  pokus ${attempt} zlyhal (${(e as Error).message}), skúšam znova…`);
      await new Promise(r => setTimeout(r, attempt * 2000));
    }
  }
  throw new Error(`Export sa nepodarilo získať. Stiahni ručne: curl -sL "${EXPORT_URL}" -o ${localPath}`);
}

async function main() {
  console.log('📄 build-city-contracts — prehliadateľné zmluvy mesta (CORA 778)');
  console.log('  Načítavam open-data JSON export zmlúv…');
  const raw = await loadExport();
  console.log(`  Export: ${raw.length} zmlúv`);

  const kept = raw.filter(r => !isGrave(r));
  const graves = raw.length - kept.length;
  console.log(`  Vynechané hrobové miesta (osobné údaje): ${graves}`);

  const contracts = kept.map(r => {
    const amount = parseEur(r['Cena_celkom'] || '');
    return {
      cislo: (r['Centrálne_číslo_zmluvy'] || '').trim(),
      rok: (r['Rok'] || '').trim(),
      typ: (r['Typ'] || '').trim(),
      druh: (r['Druh'] || '').trim(),
      strany: anonymizeParties(cleanParties(r['Zmluvné_strany'] || '')),
      predmet: (r['Predmet'] || '').trim().slice(0, 400),
      suma: Math.round(amount * 100) / 100,
      mena: (r['Mena'] || '').trim(),
      podpis: (r['Dátum_podpisu'] || '').trim(),
    };
  });
  const anonymized = contracts.filter(c => c.strany.includes('Fyzická osoba')).length;
  console.log(`  Anonymizovaných zmlúv s fyzickou osobou (GDPR): ${anonymized}`);

  // agregáty
  const byYear: Record<string, number> = {};
  const byType: Record<string, number> = {};
  let priced = 0, big = 0, huge = 0;
  for (const c of contracts) {
    if (/^\d{4}$/.test(c.rok)) byYear[c.rok] = (byYear[c.rok] || 0) + 1;
    const t = c.typ || '—';
    byType[t] = (byType[t] || 0) + 1;
    if (c.suma > 0) priced++;
    if (c.suma >= BIG) big++;
    if (c.suma >= 100000) huge++;
  }
  const topTypes = Object.entries(byType).sort((a, b) => b[1] - a[1]).slice(0, 12);

  const stats = {
    generatedAt: new Date().toISOString(),
    source: 'egov.martin.sk CORA 778 (zmluvy mesta) — open-data JSON export',
    sourceUrl: SOURCE_URL,
    note: 'Prehliadateľné zmluvy mesta Martin (od 2011). Vynechané nájmy hrobových miest (osobné údaje občanov, nie výdavok mesta). Sumy sú per zmluva; celkový súčet neuvádzame, lebo dodatky recyklujú celkovú cenu (nie deltu). Zmluvy nemajú v exporte IČO.',
    totalContracts: contracts.length,
    excludedGraves: graves,
    anonymizedPersons: anonymized,
    pricedContracts: priced,
    bigThreshold: BIG,
    bigCount: big,
    hugeCount: huge,
    byYear: Object.fromEntries(Object.entries(byYear).sort()),
    topTypes,
  };

  // 1) malé agregáty (static import pre prehľad)
  const statsPath = resolve(process.cwd(), 'src/data/city-contract-stats.json');
  writeFileSync(statsPath, JSON.stringify(stats, null, 2));

  // 2) celý prehliadateľný set (lazy fetch z /public, NIE static import)
  const pubDir = resolve(process.cwd(), 'public/data');
  if (!existsSync(pubDir)) mkdirSync(pubDir, { recursive: true });
  const dataPath = resolve(pubDir, 'city-contracts.json');
  // zoradené: najnovšie roky a najvyššie sumy hore
  contracts.sort((a, b) => (Number(b.rok) - Number(a.rok)) || (b.suma - a.suma));
  writeFileSync(dataPath, JSON.stringify(contracts));

  console.log('✅ Zapísané:');
  console.log(`  ${statsPath}`);
  console.log(`  ${dataPath} (${(JSON.stringify(contracts).length / 1024 / 1024).toFixed(2)} MB, ${contracts.length} zmlúv)`);
  console.log(`  Roky: ${Object.keys(stats.byYear).join(', ')}`);
  console.log(`  Priced: ${priced} | ≥10k: ${big} | ≥100k: ${huge}`);
}
main().then(() => process.exit(0)).catch(e => { console.error('CHYBA:', e); process.exit(1); });
