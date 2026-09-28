import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';
import { chromium, Page } from 'playwright';
import { correctIco } from '../lib/entity-ico-fixes';

// ─────────────────────────────────────────────────────────────────────────────
// Krtko: Mesto Martin — REÁLNY scraper dodávateľských faktúr z CORA eGOV portálu
// (egov.martin.sk, NavigationState 779). Mesto NIE je napojené na centrálny CES,
// takže otvorené dáta neexistujú — portál je jediný zdroj. ~158 000 faktúr od 2010.
//
// DVOJFÁZOVÁ ARCHITEKTÚRA (overené prieskumom, viď git história _probe_*):
//  FÁZA 1 (--phase=list): page size 500 (strop CORA; overené), prejdi celú históriu
//    (~316 strán namiesto 15 788 pri 10/str), batch-upsert po stranách. Zoznam nesie
//    číslo, DODÁVATEĽ (meno), suma, dátum — ICO CHÝBA → supplier_entity_id = NULL.
//  FÁZA 2 (--phase=ico): IČO je len v DETAILE. Detail sa otvára cez __doPostBack, ktorý
//    je NEZÁVISLÝ OD STRANY (overené: cudzí docId sa otvorí z ktorejkoľvek strany) —
//    cez dočasný <a onclick> element (non-strict kontext, inak strict-mode padne).
//    IČO ťaháme LEN pre faktúry >= MIN_AMOUNT (cross-check s CRZ = "faktúra bez zmluvy").
//    Resume-safe: berie len faktúry, ktoré ešte nemajú dodávateľa.
//
// Prečo dve fázy: detail pri page size 500 NEVRACIA IČO (overené), pri 10 áno. Preto
// zber zoznamu ide rýchlo pri 500 a IČO sa dotiahne osobitne cez page-independent postback.
//
// BEZPEČNOSŤ (poučenie z pôvodného fabrikovaného stubu): LEN reálne hodnoty zo zdroja.
// Faktúra bez IČO sa uloží s NULL supplier — NIKDY "Neznáma firma" ani odhad IČO.
// Idempotentné na external_id (MM_INV_<docId>).
//
// Spustenie:
//   npm run krtko:egov -- --phase=list            (dry-run zberu zoznamu)
//   npm run krtko:egov -- --phase=list --apply     (zápis celej histórie)
//   npm run krtko:egov -- --phase=list --apply --max-pages=50   (obmedz strany)
//   npm run krtko:egov -- --phase=ico --apply      (dotiahni IČO pre red-flagy)
// ─────────────────────────────────────────────────────────────────────────────

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
dotenv.config({ path: resolve(process.cwd(), '.env.local') });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const APPLY = process.argv.includes('--apply');
const phaseArg = process.argv.find(a => a.startsWith('--phase='));
const PHASE = phaseArg ? phaseArg.split('=')[1] : 'list';
const maxPagesArg = process.argv.find(a => a.startsWith('--max-pages='));
const MAX_PAGES = maxPagesArg ? parseInt(maxPagesArg.split('=')[1], 10) : 100000;
const PAGE_SIZE = 500;             // strop CORA (overené: 500 OK, 1000 spadne na default)
const MIN_AMOUNT_FOR_ICO = 10000;  // IČO z detailu len pre faktúry nad prahom (audit "bez zmluvy")
const MM_BUYER_ICO = '00316792';   // Mesto Martin
const LIST_URL = 'https://egov.martin.sk/Default.aspx?NavigationState=779:0:';

interface EgovRow { cislo: string; docId: string; supplierName: string; amount: number | null; date: string; }

function parseAmount(raw: string): number | null {
  const c = (raw || '').replace(/\u00a0/g, '').replace(/&nbsp;/g, '').replace(/€|EUR/gi, '').replace(/\s/g, '').replace(',', '.').trim();
  if (!c) return null;
  const n = parseFloat(c);
  return Number.isFinite(n) ? n : null;
}
function parseDate(raw: string): string | null {
  const m = (raw || '').trim().match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (!m) return null;
  return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

// Počkaj, kým zmizne ExtJS maska AJ ASP.NET AJAX UpdateProgress overlay (obe blokujú kliky).
async function waitMaskGone(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const sel = '.ext-el-mask, .x-mask, .ext-el-mask-msg, .UpdateProgress, [id*="UpdateProgress"]';
    const masks = Array.from(document.querySelectorAll(sel));
    return masks.every(m => {
      const el = m as HTMLElement;
      return el.offsetParent === null || getComputedStyle(el).display === 'none' || getComputedStyle(el).visibility === 'hidden' || el.getAttribute('aria-hidden') === 'true';
    });
  }, { timeout: 20000 }).catch(() => {});
}

// Prečítaj dátové riadky z aktuálnej strany grid-u
async function readPage(page: Page): Promise<EgovRow[]> {
  const raw = await page.evaluate(() => {
    const out: { cells: string[]; docId: string | null }[] = [];
    document.querySelectorAll('[onclick*="Detail:"]').forEach(el => {
      const tr = el.closest('tr');
      if (!tr) return;
      const m = (el.getAttribute('onclick') || '').match(/Detail:(\d+)/);
      const cells = Array.from(tr.querySelectorAll('td')).map(td => (td.textContent || '').trim());
      out.push({ cells, docId: m ? m[1] : null });
    });
    return out;
  });
  // stĺpce: [Detail, Číslo, Dodávateľ, Predmet, Celková cena, Mena, Dátum vystavenia, Dátum zverejnenia, Dokumenty]
  return raw.filter(r => r.docId).map(r => ({
    cislo: r.cells[1] || '',
    docId: r.docId!,
    supplierName: r.cells[2] || '',
    amount: parseAmount(r.cells[4] || ''),
    date: parseDate(r.cells[6] || r.cells[7] || '') || '',
  }));
}

// Nastav počet riadkov na stránku (druhý x-tbar-page-number input = page size). S retry.
async function setPageSize(page: Page, size: number): Promise<number> {
  for (let attempt = 1; attempt <= 4; attempt++) {
    await waitMaskGone(page);
    const loc = page.locator('.x-tbar-page-number').nth(1);
    try {
      await loc.click({ timeout: 8000 });
      await loc.fill('');
      await loc.fill(String(size));
      await loc.press('Enter');
    } catch { await page.waitForTimeout(2000); continue; }
    await page.waitForLoadState('networkidle').catch(() => {});
    await waitMaskGone(page);
    await page.waitForTimeout(4000);
    const got = await page.$$eval('[onclick*="Detail:"]', e => e.length);
    if (got > 10) return got;
    await page.waitForTimeout(1500);
  }
  return page.$$eval('[onclick*="Detail:"]', e => e.length);
}

// Prvý docId aktuálnej strany (na detekciu, či page-next reálne posunul).
async function firstDocId(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const el = document.querySelector('[onclick*="Detail:"]');
    const m = (el?.getAttribute('onclick') || '').match(/Detail:(\d+)/);
    return m ? m[1] : null;
  });
}

// Ďalšia strana cez page-next; vráť false ak sa obsah nezmenil (koniec) alebo tlačidlo disabled.
async function goNextPage(page: Page, prevFirst: string | null): Promise<boolean> {
  await waitMaskGone(page);
  const clicked = await page.evaluate(() => {
    const btn = document.querySelector('.x-tbar-page-next:not(.x-item-disabled)') as HTMLElement | null;
    if (btn) { btn.click(); return true; }
    return false;
  });
  if (!clicked) return false;
  await page.waitForLoadState('networkidle').catch(() => {});
  await waitMaskGone(page);
  // počkaj kým sa zmení prvý docId (postback dobehol)
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(500);
    const now = await firstDocId(page);
    if (now && now !== prevFirst) return true;
  }
  return false; // obsah sa nezmenil → koniec
}

// Postback target grid-u (pre page-independent otváranie detailu).
async function getPostbackTarget(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const el = document.querySelector('[onclick*="Detail:"]');
    const m = (el?.getAttribute('onclick') || '').match(/__doPostBack\('([^']+)'/);
    return m ? m[1] : null;
  });
}

// Otvor detail ĽUBOVOĽNÉHO docId cez dočasný <a onclick> (non-strict) a prečítaj IČO + meno.
async function fetchIcoByPostback(page: Page, target: string, docId: string): Promise<{ ico: string | null; name: string | null }> {
  await waitMaskGone(page);
  await page.evaluate(({ t, id }) => {
    const a = document.createElement('a');
    a.href = '#'; a.id = '__tmpDetail';
    a.setAttribute('onclick', `__doPostBack('${t}','Detail:${id}');return false;`);
    document.body.appendChild(a);
    a.click();
    a.remove();
  }, { t: target, id: docId });
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1800);
  const info = await page.evaluate(() => {
    const lines = document.body.innerText.split('\n').map(l => l.trim());
    const iIco = lines.findIndex(l => /IČO\s*\/\s*RČ|^IČO$/i.test(l));
    const ico = iIco >= 0 && iIco + 1 < lines.length ? (lines[iIco + 1].match(/(\d{6,8})/) || [])[1] || null : null;
    const iDod = lines.findIndex(l => /^Dodávateľ$/i.test(l));
    const name = iDod >= 0 && iDod + 1 < lines.length ? lines[iDod + 1] : null;
    return { ico, name };
  });
  // zatvor detail, aby ďalší postback fungoval
  const closed = await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button, .x-btn-text, [onclick]'))
      .find(el => /^(Späť|Zavrieť|Zrušiť|Naspäť)$/i.test((el.textContent || '').trim())) as HTMLElement | null;
    if (btn) { btn.click(); return true; }
    return false;
  });
  if (!closed) await page.keyboard.press('Escape');
  await page.waitForLoadState('networkidle').catch(() => {});
  await waitMaskGone(page);
  await page.waitForTimeout(500);
  return info;
}

// ─────────────────────────── FÁZA 1: zber zoznamu ───────────────────────────
async function phaseList(page: Page, buyerId: string) {
  console.log(`  FÁZA 1 (zoznam) — page size ${PAGE_SIZE}, max ${MAX_PAGES} strán\n`);
  const got = await setPageSize(page, PAGE_SIZE);
  console.log(`  Riadkov na stranu: ${got}`);
  if (got < 100) { console.error('  Page size sa nenastavil — CORA vrátila', got); return; }

  const seen = new Set<string>();
  let collected = 0, wrote = 0, pageNum = 0;
  let totalSum = 0;

  while (pageNum < MAX_PAGES) {
    pageNum++;
    let rows: EgovRow[];
    try { rows = await readPage(page); } catch { console.log(`\n  (čítanie strany ${pageNum} zlyhalo)`); break; }

    const batch: Record<string, unknown>[] = [];
    for (const r of rows) {
      if (seen.has(r.docId)) continue;
      seen.add(r.docId);
      if (r.amount === null || !r.date) continue;
      collected++;
      totalSum += r.amount;
      batch.push({
        external_id: `MM_INV_${r.docId}`,
        source_type: 'WEB_INVOICE',
        source_url: LIST_URL,
        buyer_entity_id: buyerId,
        supplier_entity_id: null,
        amount_eur: r.amount,
        date_published: r.date,
        subject: `Faktúra ${r.cislo} — ${r.supplierName}`.slice(0, 300),  // meno v subject (schéma nemá zvlášť stĺpec)
      });
    }
    if (APPLY && batch.length) {
      const { error } = await supabase.from('transactions').upsert(batch, { onConflict: 'external_id' });
      if (error) console.log(`\n  upsert chyba strana ${pageNum}: ${error.message}`);
      else wrote += batch.length;
    }
    process.stdout.write(`\r  strana ${pageNum} — zozbieraných ${collected}${APPLY ? `, zapísaných ${wrote}` : ''}`);

    const curFirst = await firstDocId(page);
    const advanced = await goNextPage(page, curFirst);
    if (!advanced) { console.log(`\n  (koniec stránkovania na strane ${pageNum})`); break; }
  }
  console.log('');
  console.log(`\n📊 FÁZA 1 hotová: ${collected} faktúr, objem ${totalSum.toLocaleString('sk-SK', { minimumFractionDigits: 2 })} €`);
  if (APPLY) {
    console.log(`   Zapísaných/aktualizovaných: ${wrote}`);
    await supabase.from('system_logs').insert({ source: 'EGOV_SCRAPER', message: `eGOV Martin FÁZA 1: ${wrote} faktúr (zoznam, ${pageNum} strán).`, parsed_data: { wrote, collected, totalSum, pages: pageNum } });
  } else {
    console.log(`\n✅ DRY-RUN. Pre zápis: --phase=list --apply`);
  }
}

// Normalizácia mena firmy pre PRESNÉ párovanie (žiadne fuzzy — chybné IČO = chybné obvinenie).
function normName(s: string): string {
  return (s || '').toLowerCase().replace(/[.,]/g, '').replace(/\s+/g, ' ')
    .replace(/\b(s r o|spol s r o|a s|akciová spoločnosť|n o|o z|k s|v o s)\b/g, '').trim();
}
function extractSupplierName(subject: string): string | null {
  const m = (subject || '').match(/—\s*(.+)$/);
  return m ? m[1].trim() : null;
}

// ─────────────────────────── FÁZA 2: IČO pre red-flagy ───────────────────────────
async function phaseIco(page: Page) {
  console.log(`  FÁZA 2 (IČO) — faktúry >= ${MIN_AMOUNT_FOR_ICO} € bez dodávateľa\n`);

  // faktúry nad prahom, ktoré ešte nemajú dodávateľa (resume-safe).
  // POZOR: Supabase .select() ticho limituje na 1000 riadkov → paginovať cez .range().
  type TodoRow = { id: string; external_id: string; amount_eur: number; subject: string };
  const todo: TodoRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('transactions')
      .select('id, external_id, amount_eur, subject')
      .eq('source_type', 'WEB_INVOICE')
      .is('supplier_entity_id', null)
      .gte('amount_eur', MIN_AMOUNT_FOR_ICO)
      .order('amount_eur', { ascending: false })
      .range(from, from + 999);
    if (error) { console.error('  DB chyba:', error.message); return; }
    if (!data || !data.length) break;
    todo.push(...(data as TodoRow[]));
    if (data.length < 1000) break;
  }
  console.log(`  Na spracovanie: ${todo.length} faktúr`);
  if (!todo.length) return;

  // KROK A — spáruj podľa PRESNÉHO mena na existujúce entity s IČO (bez postbacku, rýchle).
  // Postback (autoritatívny detail) použijeme len pre tie, čo sa nedajú presne spárovať.
  const nameToEntity = new Map<string, string>(); // normName -> entity id
  for (let from = 0; ; from += 1000) {
    const { data } = await supabase.from('entities').select('id, ico, name').not('ico', 'is', null).range(from, from + 999);
    if (!data || !data.length) break;
    for (const e of data) {
      if (e.name && e.ico) { const n = normName(e.name); nameToEntity.set(n, e.id as string); }
    }
    if (data.length < 1000) break;
  }

  const supCache = new Map<string, string>();
  let matched = 0, viaPostback = 0, noIco = 0, done = 0;
  const needPostback: { id: string; docId: string }[] = [];

  for (const t of todo) {
    const name = extractSupplierName(t.subject as string);
    const key = name ? normName(name) : '';
    if (key && nameToEntity.has(key)) {
      // presná zhoda mena → použijeme existujúce IČO (deterministické, žiadny odhad)
      if (APPLY) await supabase.from('transactions').update({ supplier_entity_id: nameToEntity.get(key)! }).eq('id', t.id);
      matched++;
    } else {
      needPostback.push({ id: t.id as string, docId: (t.external_id as string).replace('MM_INV_', '') });
    }
    done++;
    if (done % 200 === 0) process.stdout.write(`\r  KROK A (meno): ${done}/${todo.length} — spárovaných ${matched}, na postback ${needPostback.length}`);
  }
  console.log(`\n  KROK A hotový: ${matched} spárovaných podľa mena, ${needPostback.length} treba postback.`);

  // KROK B — postback (autoritatívny detail) pre nespárované.
  const target = await getPostbackTarget(page);
  if (!target) { console.error('  Nenašiel sa postback target — KROK B preskočený.'); return; }
  let pb = 0;
  for (const item of needPostback) {
    let ico: string | null = null, dname: string | null = null;
    try { const r = await fetchIcoByPostback(page, target, item.docId); ico = r.ico; dname = r.name; } catch { ico = null; }
    if (ico) ico = correctIco(ico) ?? ico;
    pb++;
    if (ico && /^\d{6,8}$/.test(ico)) {
      viaPostback++;
      let supplierId = supCache.get(ico) ?? null;
      if (!supplierId) {
        const cleanName = (dname || `IČO ${ico}`).trim();
        const { data: sup } = await supabase.from('entities')
          .upsert({ ico, name: cleanName, type: 'COMPANY', normalized_name: cleanName.toLowerCase() }, { onConflict: 'ico' })
          .select('id').single();
        if (sup) { supplierId = sup.id as string; supCache.set(ico, supplierId); }
      }
      if (APPLY && supplierId) await supabase.from('transactions').update({ supplier_entity_id: supplierId }).eq('id', item.id);
    } else {
      noIco++;
    }
    if (pb % 10 === 0 || pb === needPostback.length) process.stdout.write(`\r  KROK B (postback): ${pb}/${needPostback.length} — s IČO ${viaPostback}, bez IČO ${noIco}`);
  }
  console.log('');
  console.log(`\n📊 FÁZA 2 hotová: ${matched} podľa mena + ${viaPostback} cez postback = ${matched + viaPostback} s IČO; ${noIco} bez IČO.`);
  if (APPLY) {
    await supabase.from('system_logs').insert({ source: 'EGOV_SCRAPER', message: `eGOV Martin FÁZA 2: ${matched + viaPostback} IČO priradených (${matched} meno, ${viaPostback} postback).`, parsed_data: { matched, viaPostback, noIco } });
  } else {
    console.log(`\n✅ DRY-RUN. Pre zápis: --phase=ico --apply`);
  }
}

async function main() {
  console.log(`🏛️  Krtko eGOV Martin — ${APPLY ? 'APPLY' : 'DRY-RUN'} | fáza=${PHASE}\n`);
  const { data: buyer } = await supabase.from('entities').select('id').eq('ico', MM_BUYER_ICO).single();
  if (!buyer) { console.error(`Buyer Mesto Martin (${MM_BUYER_ICO}) neexistuje v DB.`); process.exit(1); }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.setDefaultTimeout(40000);
  await page.goto(LIST_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);

  if (PHASE === 'list') await phaseList(page, buyer.id as string);
  else if (PHASE === 'ico') await phaseIco(page);
  else console.error(`Neznáma fáza: ${PHASE} (použi list alebo ico)`);

  await browser.close();
}
main().then(() => process.exit(0)).catch(e => { console.error('CHYBA:', e); process.exit(1); });
