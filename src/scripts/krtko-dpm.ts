import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';
import { correctIco } from '../lib/entity-ico-fixes';

// ─────────────────────────────────────────────────────────────────────────────
// Krtko: DPM Martin — REÁLNY scraper faktúr a objednávok
//
// Zdroj: https://zverejnovanie.dpmmartin.sk/{invoices,orders} — Dopravný podnik
// mesta Martin, s.r.o. povinne zverejňuje faktúry a objednávky (zákon 211/2000).
// Celý zoznam je jedna server-rendered stránka (žiadny AJAX/stránkovanie), každý
// riadok tabuľky nesie: číslo, názov, dodávateľ + IČO, suma, dátum, typ.
//
// PREČO je toto bezpečné (na rozdiel od pôvodného scraper-invoices.ts NO-OP,
// ktorý vkladal mock/fabrikáty): berieme LEN reálne hodnoty zo zdroja —
// skutočný dátum faktúry (nie dátum behu), skutočné meno + IČO dodávateľa
// (nie "Neznáma firma" fallback). Riadok bez platného IČO alebo bez sumy
// PRESKOČÍME a zalogujeme — nikdy nehádame ani nedopĺňame.
//
// Sumy: DPM formátuje "12 607,50 €" s NBSP/medzerou ako tisícovým oddeľovačom.
// Parser MUSÍ zbaviť VŠETKY druhy medzier pred parseFloat, inak nastane
// systémový "useknutý tisíc" bug (parseFloat("12 607.50") = 12).
//
// Spustenie:  npm run krtko:dpm            (dry-run, nič nezapíše)
//             npm run krtko:dpm -- --apply (zapíše do DB)
// ─────────────────────────────────────────────────────────────────────────────

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Chýbajú Supabase kľúče v .env.local!');
  process.exit(1);
}
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const APPLY = process.argv.includes('--apply');
const DPM_BUYER_ICO = '53560922'; // Dopravný podnik mesta Martin, s.r.o.
const SOURCES = [
  { url: 'https://zverejnovanie.dpmmartin.sk/invoices', kind: 'invoice' as const },
  { url: 'https://zverejnovanie.dpmmartin.sk/orders', kind: 'order' as const },
];

interface DpmRow {
  cislo: string;
  docId: string;
  supplierName: string;
  supplierIco: string | null;
  amount: number | null;
  date: string;        // ISO YYYY-MM-DD
  kind: 'invoice' | 'order';
}

/** Normalizuj sumu zo zdroja: "12 607,50 €" / NBSP / &nbsp; -> 12607.50 */
function parseAmount(raw: string): number | null {
  const cleaned = raw
    .replace(/&nbsp;|&#160;/g, '')
    .replace(/\u00a0/g, '')
    .replace(/€|EUR/gi, '')
    .replace(/\s/g, '')
    .replace(',', '.')
    .trim();
  if (!cleaned) return null;
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** DD.MM.YYYY -> YYYY-MM-DD (ISO). Vráti null pri nevalidnom dátume. */
function parseDate(raw: string): string | null {
  const m = raw.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!m) return null;
  const [, d, mo, y] = m;
  const dd = d.padStart(2, '0');
  const mm = mo.padStart(2, '0');
  return `${y}-${mm}-${dd}`;
}

/** Naparsuj tabuľkové riadky zo server-rendered HTML zoznamu. */
function parseRows(html: string, kind: 'invoice' | 'order'): DpmRow[] {
  const rows: DpmRow[] = [];
  // Každý dátový riadok: 7 <td>, druhý má <a href="/detail-document/?document=ID">
  const rowRe = /<td>([^<]*)<\/td>\s*<td><a href="\/detail-document\/?\?document=(\d+)"[^>]*>[^<]*<\/a><\/td>\s*<td>([^<]*?)(?:\(IČO:\s*([0-9]+)\))?\s*<\/td>\s*<td>([^<]*?)<\/td>\s*<td>([0-9.]+)<\/td>\s*<td>([^<]*)<\/td>/g;
  let m: RegExpExecArray | null;
  while ((m = rowRe.exec(html)) !== null) {
    const [, cislo, docId, supplierNameRaw, icoRaw, amountRaw, dateRaw] = m;
    const supplierName = supplierNameRaw.trim();
    const isoDate = parseDate(dateRaw);
    const amount = parseAmount(amountRaw);
    let ico: string | null = icoRaw ? icoRaw.trim() : null;
    if (ico) ico = correctIco(ico) ?? ico;
    rows.push({
      cislo: cislo.trim(),
      docId,
      supplierName,
      supplierIco: ico,
      amount,
      date: isoDate ?? '',
      kind,
    });
  }
  return rows;
}

async function fetchList(url: string): Promise<string> {
  const res = await fetch(url, { signal: AbortSignal.timeout(60000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} pre ${url}`);
  return res.text();
}

async function main() {
  console.log(`🚌 Krtko DPM — ${APPLY ? 'APPLY (zapisujem do DB)' : 'DRY-RUN (nič nezapíšem)'}\n`);

  // 1. Získať buyer entitu (musí existovať)
  const { data: buyer } = await supabase.from('entities').select('id').eq('ico', DPM_BUYER_ICO).single();
  if (!buyer) {
    console.error(`Buyer DPM (IČO ${DPM_BUYER_ICO}) neexistuje v DB. Končím.`);
    process.exit(1);
  }

  // 2. Stiahnuť a naparsovať všetky zdroje
  const all: DpmRow[] = [];
  for (const src of SOURCES) {
    const html = await fetchList(src.url);
    const rows = parseRows(html, src.kind);
    console.log(`  ${src.url}: ${rows.length} riadkov`);
    all.push(...rows);
  }

  // 3. Validácia — rozdeľ na použiteľné vs preskočené (nikdy nehádame)
  const usable: DpmRow[] = [];
  const skipped: { row: DpmRow; reason: string }[] = [];
  for (const r of all) {
    if (!r.supplierIco || !/^\d{6,8}$/.test(r.supplierIco)) { skipped.push({ row: r, reason: 'chýba/nevalidné IČO' }); continue; }
    if (r.amount === null) { skipped.push({ row: r, reason: 'nevyparsovaná suma' }); continue; }
    if (!r.date) { skipped.push({ row: r, reason: 'nevalidný dátum' }); continue; }
    usable.push(r);
  }

  const totalSum = usable.reduce((s, r) => s + (r.amount || 0), 0);
  console.log(`\n📊 Spolu ${all.length} riadkov: ${usable.length} použiteľných, ${skipped.length} preskočených`);
  console.log(`   Objem: ${totalSum.toLocaleString('sk-SK', { minimumFractionDigits: 2 })} €`);
  const byKind = usable.reduce((a, r) => { a[r.kind] = (a[r.kind] || 0) + 1; return a; }, {} as Record<string, number>);
  console.log(`   Podľa typu:`, byKind);
  if (skipped.length) {
    console.log(`\n⏭️  Preskočené (prvých 10):`);
    skipped.slice(0, 10).forEach(s => console.log(`   [${s.reason}] ${s.row.cislo} | ${s.row.supplierName} | ${s.row.amount} € | ${s.row.date}`));
  }
  console.log(`\n🔎 Vzorka použiteľných (prvých 5):`);
  usable.slice(0, 5).forEach(r => console.log(`   ${r.cislo} | ${r.supplierName} (${r.supplierIco}) | ${r.amount} € | ${r.date} | ${r.kind}`));

  if (!APPLY) {
    console.log(`\n✅ DRY-RUN hotový. Pre zápis spusti s --apply.`);
    return;
  }

  // 4. APPLY: upsert dodávateľov (dedup na IČO) + transakcií (idempotent na external_id)
  console.log(`\n💾 Zapisujem...`);
  const supplierIdCache = new Map<string, string>();
  let wrote = 0, entErr = 0, txErr = 0;
  for (const r of usable) {
    let supplierId = supplierIdCache.get(r.supplierIco!);
    if (!supplierId) {
      const { data: sup, error } = await supabase.from('entities')
        .upsert({ ico: r.supplierIco, name: r.supplierName, type: 'COMPANY', normalized_name: r.supplierName.toLowerCase() }, { onConflict: 'ico' })
        .select('id').single();
      if (error || !sup) { entErr++; continue; }
      supplierId = sup.id;
      supplierIdCache.set(r.supplierIco!, supplierId);
    }
    // external_id deterministický z docId -> idempotentné, žiadne duplicity pri re-behu
    const externalId = `DPM_INV_${r.docId}`;
    const subject = r.kind === 'order' ? `Objednávka ${r.cislo}` : `Faktúra ${r.cislo}`;
    const { error: txError } = await supabase.from('transactions').upsert({
      external_id: externalId,
      source_type: 'WEB_INVOICE',
      source_url: `https://zverejnovanie.dpmmartin.sk/detail-document?document=${r.docId}`,
      buyer_entity_id: buyer.id,
      supplier_entity_id: supplierId as string,
      amount_eur: r.amount,
      date_published: r.date,
      subject,
    }, { onConflict: 'external_id' });
    if (txError) { txErr++; continue; }
    wrote++;
  }
  console.log(`\n🎉 Hotovo: zapísaných ${wrote}, chyby entít ${entErr}, chyby tx ${txErr}.`);
  await supabase.from('system_logs').insert({
    source: 'DPM_SCRAPER',
    message: `DPM scraper: ${wrote} faktúr/objednávok zapísaných (${skipped.length} preskočených).`,
    parsed_data: { wrote, skipped: skipped.length, totalSum },
  });
}

main().then(() => process.exit(0)).catch(e => { console.error('CHYBA:', e); process.exit(1); });
