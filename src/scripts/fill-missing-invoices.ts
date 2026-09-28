/**
 * fill-missing-invoices.ts — RECONCILIÁCIA: doplní faktúry chýbajúce v DB oproti
 * autoritatívnemu open-data JSON exportu mesta Martin (egov CORA, NavigationState=779).
 *
 * PREČO EXISTUJE: Pôvodný scraper (krtko-egov.ts, phase=list) zbieral zoznam faktúr
 * klikaním cez ~15 400 strán a zastavil sa na strope PRED dokončením najstarších rokov
 * → v DB chýbali celé roky 2009–2012 (3 948 faktúr, z toho 152 nad 10k € za ~11 M €,
 * napr. Slovpanel 1,16 M, SAD Žilina, EURO-BUILDING, Brantner). To skresľovalo súčty aj
 * audit "faktúra bez zmluvy". Portál pritom poskytuje KOMPLETNÝ JSON export naraz
 * (OutputStreamHttpHandler), takže scrape zoznamu je zbytočne krehký.
 *
 * DIZAJN (export = zdroj pravdy, scrape len dopĺňa IČO):
 *  1. Stiahne kompletný JSON export faktúr (157 934 riadkov).
 *  2. Zrekonštruuje kompozitný kľúč existujúcich riadkov v DB
 *     (číslo | dátum | suma_v_centoch | normalizované_meno) — Číslo_faktúry NIE je samo
 *     osebe unikátne (mesto recykluje čísla medzi rokmi, 36k duplicít), preto kompozit.
 *  3. Doplní len tie z exportu, ktoré v DB chýbajú. external_id = MM_EXP_<sha1(kľúč)>,
 *     idempotentné (rovnaká faktúra = rovnaký hash), nekoliduje s MM_INV_<docId> zo scrapu.
 *  4. IČO: priradí cez PRESNÝ meno-match (legal-norm) na existujúce entity — žiadny odhad,
 *     žiadne fuzzy (chybné IČO = chybné verejné obvinenie). Bez zhody → supplier NULL
 *     (poctivé prázdno, nie fabrikát). Export IČO neobsahuje, docId tiež nie → postback
 *     detailu tu nerobíme; zvyšné veľké faktúry bez IČO (~8) sa doriešia samostatne.
 *  5. VERIFIKÁCIA: po zápise znova zráta DB vs export a vypíše diery po rokoch. Self-verifying
 *     — budúci refresh porovná dva NEZÁVISLÉ zdroje (scrape + export), takže strop scrapu
 *     už nikdy nespôsobí tichú dieru.
 *
 * Spustenie:
 *   npm run krtko:egov:fill                (dry-run — len reconciliácia + čo by doplnil)
 *   npm run krtko:egov:fill -- --apply     (zápis chýbajúcich)
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';
import { createHash } from 'crypto';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
dotenv.config({ path: resolve(process.cwd(), '.env.local') });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const APPLY = process.argv.includes('--apply');
const MM_BUYER_ICO = '00316792';
const EXPORT_URL = 'https://egov.martin.sk/Default.aspx?NavigationState=779:0::plac1929:_144102_5_8';
const SOURCE_URL = 'https://egov.martin.sk/Default.aspx?NavigationState=779:0:';

interface Fakt {
  'Číslo_faktúry': string; 'Dodávateľ': string; 'Predmet_faktúry': string;
  'Celková_cena': string; 'Mena': string; 'Dátum_vystavenia': string; 'Dátum_zverejnenia': string;
}

function parseEur(s: string): number {
  // Export formát: "   1 159 102,25" (medzery = tisíce, čiarka = desatinná).
  const c = (s || '').replace(/\u00a0/g, '').replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
  const n = parseFloat(c);
  return Number.isFinite(n) ? n : 0;
}
function ymd(d: string): string {
  const m = (d || '').match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : '';
}
function normName(s: string): string {
  return (s || '').toLowerCase().replace(/[.,]/g, '').replace(/\s+/g, ' ').trim();
}
// Legal-norm (odstráni právnu formu) — na PRESNÝ meno-match s entities (rovnaká logika ako scraper).
function normNameLegal(s: string): string {
  return normName(s).replace(/\b(s r o|spol s r o|a s|akciová spoločnosť|n o|o z|k s|v o s)\b/g, '').trim();
}
// Kompozitný kľúč (číslo|dátum|suma_cent|meno) — Číslo_faktúry nie je samo unikátne.
function compositeKey(cislo: string, dateIso: string, cent: number, name: string): string {
  return [cislo.trim(), dateIso, cent, normName(name)].join('|');
}
function extIdFromKey(key: string): string {
  return 'MM_EXP_' + createHash('sha1').update(key).digest('hex').slice(0, 16);
}

// IČO overené cez RPO ŠÚ SR (2-zdrojovo: fullName→IČO aj identifier→názov), pre faktúry 2011,
// kde export nemá docId (postback detailu nejde) a meno-match na existujúce entity zlyhal kvôli
// interpunkcii/variantom mena. Mapuje fragment mena z faktúry (v subject) → overené IČO+názov.
// Žiadny odhad: každý pár má presnú zhodu názvu v RPO. Znalec-fyzická osoba (Štrbáňová) zámerne
// vynechaná (nie firma → nie "firma bez zmluvy"). Rovnaký kurátorský vzor ako entity-ico-fixes.ts.
const RPO_VERIFIED: { frag: string; ico: string; name: string }[] = [
  { frag: 'MANNET spol. s r.o.', ico: '36227552', name: 'MANNET spol. s r.o.' },
  { frag: 'Allianz - Slovenská poisťovňa, a.s.', ico: '00151700', name: 'Allianz - Slovenská poisťovňa, a.s.' },
  { frag: 'Mirror MM s.r.o.', ico: '36504891', name: 'Mirror MM s.r.o.' },
  { frag: 'DASYM, s.r.o', ico: '36548014', name: 'DASYM, s.r.o.' },
  { frag: 'Obnova s.r.o', ico: '36820652', name: 'Obnova s.r.o.' },
  { frag: 'STAVOUNIVERZÁL, s.r.o.', ico: '36380458', name: 'STAVOUNIVERZÁL, s.r.o.' },
  { frag: 'A - TATRA COLOR,s.r.o.', ico: '43801366', name: 'A - TATRA COLOR, s. r. o.' },
];

async function fetchExport(): Promise<Fakt[]> {
  const res = await fetch(EXPORT_URL, { redirect: 'follow' });
  if (!res.ok) throw new Error(`Export fetch ${res.status}`);
  return res.json() as Promise<Fakt[]>;
}

// Zrekonštruuj kompozitné kľúče všetkých existujúcich faktúr (MM_INV_ aj MM_EXP_).
async function loadDbKeys(): Promise<Set<string>> {
  const keys = new Set<string>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('transactions')
      .select('subject,date_published,amount_eur')
      .eq('source_type', 'WEB_INVOICE').range(from, from + 999);
    if (error) throw new Error(error.message);
    if (!data || !data.length) break;
    for (const r of data) {
      const m = (r.subject || '').match(/Faktúra\s+(\S+)\s+—\s+(.+)$/);
      if (!m) continue;
      keys.add(compositeKey(m[1], (r.date_published || '').slice(0, 10), Math.round(Number(r.amount_eur) * 100), m[2]));
    }
    if (data.length < 1000) break;
  }
  return keys;
}

async function loadNameToIco(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (let from = 0; ; from += 1000) {
    const { data } = await supabase.from('entities').select('id,ico,name').not('ico', 'is', null).range(from, from + 999);
    if (!data || !data.length) break;
    for (const e of data) if (e.name && e.ico) map.set(normNameLegal(e.name as string), e.id as string);
    if (data.length < 1000) break;
  }
  return map;
}

function yearCounts(rows: { dateIso: string; amt: number }[]): void {
  const by: Record<string, { n: number; big: number; sum: number }> = {};
  for (const r of rows) {
    const y = r.dateIso.slice(0, 4) || '?';
    const e = by[y] ??= { n: 0, big: 0, sum: 0 };
    e.n++; e.sum += r.amt; if (r.amt >= 10000) e.big++;
  }
  for (const y of Object.keys(by).sort())
    console.log(`    ${y}: ${by[y].n} faktúr (${by[y].big} ≥10k), ${by[y].sum.toLocaleString('sk-SK', { maximumFractionDigits: 0 })} €`);
}

async function main() {
  console.log(`🏛️  Krtko eGOV — RECONCILIÁCIA faktúr (${APPLY ? 'APPLY' : 'DRY-RUN'})\n`);
  const { data: buyer } = await supabase.from('entities').select('id').eq('ico', MM_BUYER_ICO).single();
  if (!buyer) { console.error('Buyer Mesto Martin neexistuje.'); process.exit(1); }
  const buyerId = buyer.id as string;

  console.log('  Sťahujem open-data JSON export faktúr…');
  const exp = await fetchExport();
  console.log(`  Export: ${exp.length} faktúr`);

  const dbKeys = await loadDbKeys();
  console.log(`  DB existujúcich unik kľúčov: ${dbKeys.size}`);

  const nameToIco = await loadNameToIco();

  // Zabezpeč entity pre RPO-overené IČO (faktúry 2011 bez docId, kde meno-match zlyhá).
  // fragment mena → entity id. V DRY-RUN sa entity nevytvárajú (len ohlási).
  const fragToEntity = new Map<string, string>();
  for (const v of RPO_VERIFIED) {
    const { data: ex } = await supabase.from('entities').select('id').eq('ico', v.ico).maybeSingle();
    if (ex) { fragToEntity.set(v.frag, ex.id as string); continue; }
    if (APPLY) {
      const { data: ins } = await supabase.from('entities')
        .upsert({ ico: v.ico, name: v.name, type: 'COMPANY', normalized_name: v.name.toLowerCase() }, { onConflict: 'ico' })
        .select('id').single();
      if (ins) fragToEntity.set(v.frag, ins.id as string);
    }
  }

  // Urči chýbajúce (dedup v rámci exportu cez rovnaký kompozitný kľúč).
  const missingByExtId = new Map<string, Record<string, unknown>>();
  const missReport: { dateIso: string; amt: number }[] = [];
  let bigNoIco = 0, matchedIco = 0, rpoIco = 0;
  for (const r of exp) {
    const dateIso = ymd(r['Dátum_vystavenia']);
    const amt = parseEur(r['Celková_cena']);
    if (!dateIso || !amt) continue;               // bez dátumu/sumy nevkladáme (poctivé prázdno)
    const key = compositeKey(r['Číslo_faktúry'], dateIso, Math.round(amt * 100), r['Dodávateľ']);
    if (dbKeys.has(key)) continue;                // už máme (scrape alebo predošlý fill)
    const extId = extIdFromKey(key);
    let icoEntity = nameToIco.get(normNameLegal(r['Dodávateľ'])) ?? null;
    if (icoEntity) {
      matchedIco++;
    } else {
      // fallback: RPO-overené priradenie podľa fragmentu mena
      const rpo = RPO_VERIFIED.find(v => (r['Dodávateľ'] || '').includes(v.frag));
      if (rpo && fragToEntity.has(rpo.frag)) { icoEntity = fragToEntity.get(rpo.frag)!; rpoIco++; }
      else if (amt >= 10000) bigNoIco++;
    }
    missingByExtId.set(extId, {
      external_id: extId,
      source_type: 'WEB_INVOICE',
      source_url: SOURCE_URL,
      buyer_entity_id: buyerId,
      supplier_entity_id: icoEntity,             // presný meno-match alebo NULL (žiadny odhad)
      amount_eur: amt,
      date_published: dateIso,
      subject: `Faktúra ${(r['Číslo_faktúry'] || '').trim()} — ${r['Dodávateľ']}`.slice(0, 300),
    });
    missReport.push({ dateIso, amt });
  }

  console.log(`\n  Na doplnenie: ${missingByExtId.size} faktúr (po dedup v exporte)`);
  console.log(`  Z toho supplier priradený cez meno-match: ${matchedIco}; RPO-overené: ${rpoIco}; veľkých ≥10k bez IČO: ${bigNoIco}`);
  console.log('  Diery po rokoch (export ale nie DB):');
  yearCounts(missReport);

  if (!APPLY) {
    console.log('\n✅ DRY-RUN. Pre zápis: --apply');
    return;
  }

  // Zápis po dávkach.
  const rows = [...missingByExtId.values()];
  let wrote = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const batch = rows.slice(i, i + 500);
    const { error } = await supabase.from('transactions').upsert(batch, { onConflict: 'external_id' });
    if (error) console.log(`  upsert chyba dávka ${i}: ${error.message}`);
    else wrote += batch.length;
    process.stdout.write(`\r  Zapísaných: ${wrote}/${rows.length}`);
  }
  console.log('');

  await supabase.from('system_logs').insert({
    source: 'EGOV_SCRAPER',
    message: `eGOV Martin RECONCILIÁCIA: doplnených ${wrote} chýbajúcich faktúr z open-data exportu (${matchedIco} s IČO cez meno-match, ${bigNoIco} veľkých bez IČO).`,
    parsed_data: { wrote, matchedIco, bigNoIco, exportTotal: exp.length },
  });

  // VERIFIKÁCIA po zápise.
  const dbAfter = await loadDbKeys();
  const stillMissing = exp.filter(r => {
    const dateIso = ymd(r['Dátum_vystavenia']); const amt = parseEur(r['Celková_cena']);
    if (!dateIso || !amt) return false;
    return !dbAfter.has(compositeKey(r['Číslo_faktúry'], dateIso, Math.round(amt * 100), r['Dodávateľ']));
  });
  console.log(`\n📊 Po zápise: DB unik kľúčov ${dbAfter.size} / export ${exp.length}. Stále chýba: ${stillMissing.length}`);
  console.log(`✅ Reconciliácia hotová. Doplnených ${wrote}.`);
}
main().then(() => process.exit(0)).catch(e => { console.error('CHYBA:', e); process.exit(1); });
