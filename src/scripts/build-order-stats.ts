/**
 * build-order-stats.ts — precompute OBJEDNÁVOK mesta Martin (egov CORA, NavigationState=781).
 *
 * PREČO PRECOMPUTE (nie zápis do transactions): stĺpec transactions.source_type je Postgres
 * ENUM bez hodnoty pre objednávky a DDL (ALTER TYPE) sa cez Supabase SDK nedá spraviť
 * (žiadny exec_sql RPC). Miešať objednávky do WEB_INVOICE by rozbilo faktúrové agregáty aj
 * audit. Objednávok je 91 556 — rovnaká škálovacia logika ako faktúry: agregáty + len veľké
 * (≥10k) do klienta. Preto rovnaký precompute vzor ako invoice-stats.json / supplier-contracts.json.
 *
 * VÝSTUP src/data/order-stats.json:
 *  - totalOrdered, orderCount, byYear (agregáty celej histórie 2011–2026)
 *  - bigOrders: objednávky ≥10 000 € (531 ks) s dodávateľom, IČO (meno-match na entities),
 *    sumou, dátumom, textom a auditom hasContract (má dodávateľ zmluvu mesta/CRZ?).
 *    Objednávka ≥10k bez zmluvy = otáznik rovnakého typu ako faktúra ≥10k bez zmluvy.
 *
 * IČO: presný meno-match (legal-norm) na existujúce entity. Bez zhody → ico null (poctivé
 * prázdno; export IČO nemá). hasContract z supplier-contracts.json (rovnaký zdroj ako audit faktúr).
 *
 * Spustenie: npm run build:orders
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';
import { writeFileSync, existsSync, readFileSync } from 'fs';
import supplierContracts from '../data/supplier-contracts.json';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
dotenv.config({ path: resolve(process.cwd(), '.env.local') });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const EXPORT_URL = 'https://egov.martin.sk/Default.aspx?NavigationState=781:0::plac1931:_144104_5_8';
const SOURCE_URL = 'https://egov.martin.sk/Default.aspx?NavigationState=781:0:';
const BIG = 10000;

// Interné / verejné / štátne subjekty, ktoré NIE sú "dodávateľ bez zmluvy" v pravom zmysle.
// Zhoduje sa s INTERNAL_SUPPLIER v /api/data + navyše štátne inštitúcie typické pre objednávky:
// daňový úrad (daňové odvody, nie objednávka!), finančná správa, poisťovne, súdy, ministerstvá,
// technické služby iných miest. Ich "objednávka" bez zmluvy s mestom je zákonný/rámcový vzťah,
// nie otáznik — označiť daňový úrad za red-flag = trápne falošné obvinenie na transparentnom webe.
const INTERNAL_SUPPLIER = /mesto martin|dopravný podnik|brantner|stefe|turvod|vodárensk|slovak telekom|slovenská pošta|slovenský plynárensk|stredoslovenská|východoslovenská|západoslovenská|orange slovensk|o2 slovakia|daňový úrad|finančné riaditeľstvo|finančná správa|sociálna poisťovňa|zdravotná poisťovňa|technické služby mesta|okresný súd|krajský súd|ministerstvo|štátna pokladnica|úrad práce/i;

interface Obj {
  'Číslo_objednávky': string; 'Dodávateľ': string; 'Text_objednávky': string;
  'Objednávka_spolu': string; 'Mena': string; 'Dátum_vystavenia': string; 'Dátum_zverejnenia': string;
}

function parseEur(s: string): number {
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
function normNameLegal(s: string): string {
  return normName(s).replace(/\b(s r o|spol s r o|a s|akciová spoločnosť|n o|o z|k s|v o s)\b/g, '').trim();
}

async function loadNameToIco(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (let from = 0; ; from += 1000) {
    const { data } = await supabase.from('entities').select('ico,name').not('ico', 'is', null).range(from, from + 999);
    if (!data || !data.length) break;
    for (const e of data) if (e.name && e.ico) map.set(normNameLegal(e.name as string), e.ico as string);
    if (data.length < 1000) break;
  }
  return map;
}

async function main() {
  console.log('📦 build-order-stats — precompute objednávok mesta Martin (CORA 781)');
  console.log('  Načítavam open-data JSON export objednávok…');
  // 74 MB export — server (CORA 2008) často zavrie spojenie v strede pri node fetch cez firemný
  // proxy. Preto: ak je lokálny súbor (stiahnutý cez `curl -sL <EXPORT_URL> -o <cesta>`), čítaj ho;
  // inak skús fetch s retry. Cesta cez env ORDERS_JSON alebo default TMPDIR/obj.dat.
  const localPath = process.env.ORDERS_JSON || resolve(process.env.TMPDIR || '/tmp', 'obj.dat');
  let exp: Obj[] | null = null;
  if (existsSync(localPath)) {
    console.log(`  z lokálneho súboru: ${localPath}`);
    exp = JSON.parse(readFileSync(localPath, 'utf-8')) as Obj[];
  } else {
    for (let attempt = 1; attempt <= 4 && !exp; attempt++) {
      try {
        const res = await fetch(EXPORT_URL, { redirect: 'follow' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        exp = await res.json() as Obj[];
      } catch (e) {
        console.log(`  pokus ${attempt} zlyhal (${(e as Error).message}), skúšam znova…`);
        await new Promise(r => setTimeout(r, attempt * 2000));
      }
    }
  }
  if (!exp) { console.error(`Export sa nepodarilo získať. Stiahni ručne: curl -sL "${EXPORT_URL}" -o ${localPath}`); process.exit(1); }
  console.log(`  Export: ${exp.length} objednávok`);

  const nameToIco = await loadNameToIco();
  const contractIco = new Set<string>((supplierContracts as { icoWithContract: string[] }).icoWithContract);

  const byYear: Record<string, { count: number; sum: number }> = {};
  let total = 0, count = 0, matchedIco = 0;
  const bigOrders: {
    cislo: string; supplier: string; ico: string | null; amount_eur: number;
    date: string; text: string; hasContract: boolean; suspicious: boolean;
  }[] = [];

  for (const r of exp) {
    const dateIso = ymd(r['Dátum_vystavenia']);
    const amt = parseEur(r['Objednávka_spolu']);
    if (!dateIso || !amt) continue;
    const y = dateIso.slice(0, 4) || 'unknown';
    (byYear[y] ??= { count: 0, sum: 0 }).count++;
    byYear[y].sum += amt;
    total += amt; count++;

    if (amt >= BIG) {
      const ico = nameToIco.get(normNameLegal(r['Dodávateľ'])) ?? null;
      if (ico) matchedIco++;
      const hasContract = ico ? contractIco.has(ico) : false;
      const isInternal = INTERNAL_SUPPLIER.test(r['Dodávateľ']);
      bigOrders.push({
        cislo: (r['Číslo_objednávky'] || '').trim(),
        supplier: r['Dodávateľ'],
        ico,
        amount_eur: Math.round(amt * 100) / 100,
        date: dateIso,
        text: (r['Text_objednávky'] || '').slice(0, 300),
        hasContract,
        // red-flag = veľká objednávka bez zmluvy A nie interný/štátny subjekt.
        // IČO nemáme (null) → NEoznačujeme za red-flag (nevieme overiť zmluvu = poctivé prázdno,
        // radšej prehliadnutý otáznik než falošné obvinenie neznámej firmy).
        suspicious: !!ico && !hasContract && !isInternal,
      });
    }
  }
  bigOrders.sort((a, b) => b.amount_eur - a.amount_eur);

  const out = {
    generatedAt: new Date().toISOString(),
    source: 'egov.martin.sk CORA sekcia 781 (objednávky) — open-data JSON export',
    sourceUrl: SOURCE_URL,
    note: 'Precompute objednávok. Do klienta idú agregáty + veľké objednávky ≥10k € (rovnaká škálovacia logika ako faktúry). IČO z presného meno-matchu na entities; bez zhody null. hasContract = dodávateľ má zmluvu mesta/CRZ (supplier-contracts.json).',
    totalOrdered: Math.round(total * 100) / 100,
    orderCount: count,
    bigThreshold: BIG,
    bigOrderCount: bigOrders.length,
    bigOrdersMatchedIco: matchedIco,
    byYear: Object.fromEntries(Object.entries(byYear).sort().map(([y, v]) => [y, { count: v.count, sum: Math.round(v.sum * 100) / 100 }])),
    bigOrders,
  };
  const path = resolve(process.cwd(), 'src/data/order-stats.json');
  writeFileSync(path, JSON.stringify(out, null, 2));
  console.log('✅ Zapísané:', path);
  console.log(`  totalOrdered: ${out.totalOrdered.toLocaleString('sk-SK')} € | orderCount: ${out.orderCount.toLocaleString('sk-SK')}`);
  console.log(`  veľké ≥10k: ${out.bigOrderCount} (s IČO: ${matchedIco}); red-flag (bez zmluvy, nie štátny): ${bigOrders.filter(o => o.suspicious).length}`);
  console.log(`  roky: ${Object.keys(out.byYear).join(', ')}`);
}
main().then(() => process.exit(0)).catch(e => { console.error('CHYBA:', e); process.exit(1); });
