import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';
import { chromium, Page } from 'playwright';
import { correctIco } from '../lib/entity-ico-fixes';

// ─────────────────────────────────────────────────────────────────────────────
// Krtko: Mesto Martin — REÁLNY scraper dodávateľských faktúr z CORA eGOV portálu
// (egov.martin.sk, NavigationState 779). Mesto NIE je napojené na centrálny CES,
// takže otvorené dáta neexistujú — portál je jediný zdroj.
//
// TECHNICKÁ REALITA (overené prieskumom):
//  - ~158 000 faktúr, 10 na stránku, stavové ASP.NET postbacky (ViewState/session).
//    Playwright to zvláda (na rozdiel od curl, kde paging padá na 302).
//  - Zoznam nesie: číslo, DODÁVATEĽ (meno), predmet, suma, mena, dátum. ICO CHÝBA.
//  - IČO je len v DETAILE (ďalší postback). Preto IČO ťaháme LEN pre faktúry, ktoré
//    prekročia prah (>= MIN_AMOUNT) — cross-check s CRZ potrebuje IČO.
//  - Sort podľa sumy NEFUNGUJE (CORA drží sumu ako text). Sort podľa dátumu funguje,
//    default poradie je najnovšie → berieme MAX_PAGES najnovších strán.
//
// BEZPEČNOSŤ (poučenie z pôvodného fabrikovaného stubu): LEN reálne hodnoty zo
// zdroja. Faktúra pod prahom sa NEZAPÍŠE bez IČO odhadom — buď má IČO z detailu,
// alebo sa uloží s NULL supplier (nikdy "Neznáma firma"). Idempotentné na external_id.
//
// Spustenie: npm run krtko:egov                 (dry-run)
//            npm run krtko:egov -- --apply       (zápis)
//            npm run krtko:egov -- --apply --pages=200   (viac strán histórie)
// ─────────────────────────────────────────────────────────────────────────────

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
dotenv.config({ path: resolve(process.cwd(), '.env.local') });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const APPLY = process.argv.includes('--apply');
const pagesArg = process.argv.find(a => a.startsWith('--pages='));
const MAX_PAGES = pagesArg ? parseInt(pagesArg.split('=')[1], 10) : 60; // ~600 najnovších faktúr
const MIN_AMOUNT_FOR_ICO = 10000; // IČO z detailu ťaháme len pre faktúry nad týmto prahom
const MM_BUYER_ICO = '00316792'; // Mesto Martin
const LIST_URL = 'https://egov.martin.sk/Default.aspx?NavigationState=779:0:';

interface EgovRow { cislo: string; docId: string; supplierName: string; amount: number | null; date: string; ico: string | null; }

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
    ico: null,
  }));
}

// Počkaj, kým zmizne ExtJS loading/modal maska (inak blokuje kliky).
async function waitMaskGone(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const masks = Array.from(document.querySelectorAll('.ext-el-mask, .x-mask, .ext-el-mask-msg'));
    return masks.every(m => (m as HTMLElement).offsetParent === null || getComputedStyle(m as HTMLElement).display === 'none');
  }, { timeout: 12000 }).catch(() => {});
}

// Klik na Detail konkrétneho docId a prečítaj IČO z detailu. Detail sa otvára ako
// ExtJS panel/okno — zatvárame ho (ESC / close), NIE goBack (goBack resetuje paging).
async function fetchIco(page: Page, docId: string): Promise<string | null> {
  await waitMaskGone(page);
  const icon = await page.$(`[onclick*="Detail:${docId}"]`);
  if (!icon) return null;
  try {
    await icon.click({ timeout: 8000 });
  } catch { return null; } // maska/nedostupné — radšej preskoč než zamrznúť
  await page.waitForTimeout(1600);
  const ico = await page.evaluate(() => {
    const lines = document.body.innerText.split('\n').map(l => l.trim());
    const i = lines.findIndex(l => /IČO\s*\/\s*RČ|^IČO$/i.test(l));
    if (i >= 0 && i + 1 < lines.length) {
      const m = lines[i + 1].match(/(\d{6,8})/);
      return m ? m[1] : null;
    }
    return null;
  });
  // Zatvor detail bez straty stavu grid-u: klik na "Zavrieť"/"Späť" tlačidlo, inak ESC.
  const closed = await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button, .x-btn-text, [onclick]'))
      .find(el => /^(Späť|Zavrieť|Zrušiť|Naspäť)$/i.test((el.textContent || '').trim())) as HTMLElement | null;
    if (btn) { btn.click(); return true; }
    return false;
  });
  if (!closed) { await page.keyboard.press('Escape'); }
  await page.waitForLoadState('networkidle').catch(() => {});
  await waitMaskGone(page);
  await page.waitForTimeout(600);
  return ico;
}

// Prečítaj číslo poslednej strany z pageru (napr. "z 15788") — pre info/log.
async function readLastPage(page: Page): Promise<number> {
  return page.evaluate(() => {
    const m = document.body.innerText.match(/z\s*([\d\s]+?)(?:\s|$)/);
    if (m) { const n = parseInt(m[1].replace(/\s/g, ''), 10); if (Number.isFinite(n) && n > 1) return n; }
    return 0;
  });
}

// Ďalšia strana cez page-next (default poradie CORA = najnovšie faktúry prvé).
async function goNextPage(page: Page): Promise<boolean> {
  await waitMaskGone(page);
  const clicked = await page.evaluate(() => {
    const btn = document.querySelector('.x-tbar-page-next:not(.x-item-disabled)') as HTMLElement | null;
    if (btn) { btn.click(); return true; }
    return false;
  });
  if (clicked) { await page.waitForLoadState('networkidle').catch(() => {}); await waitMaskGone(page); await page.waitForTimeout(1200); }
  return clicked;
}

async function main() {
  console.log(`🏛️  Krtko eGOV Martin — ${APPLY ? 'APPLY' : 'DRY-RUN'} | max ${MAX_PAGES} strán (najnovšie)\n`);
  const { data: buyer } = await supabase.from('entities').select('id').eq('ico', MM_BUYER_ICO).single();
  if (!buyer) { console.error(`Buyer Mesto Martin (${MM_BUYER_ICO}) neexistuje v DB.`); process.exit(1); }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.setDefaultTimeout(35000);
  await page.goto(LIST_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);

  // CORA default poradie: strana 1 = najstaršie (2010), POSLEDNÁ strana = najnovšie (2026).
  // Sort podľa dátumu/sumy je nespoľahlivý → skočíme na koniec a ideme DOZADU (najnovšie prvé).
  const lastPage = await readLastPage(page);
  console.log(`  Celkovo strán: ${lastPage || '?'} (10 faktúr/strana)`);
  if (!lastPage) { console.error('  Nepodarilo sa zistiť počet strán.'); await browser.close(); process.exit(1); }

  // Príprava zápisu (incrementálny — každá faktúra hneď, aby beh prežil pád CORA).
  const buyerId = buyer.id as string;
  const supCache = new Map<string, string>();

  async function persist(r: EgovRow): Promise<'wrote' | 'skip'> {
    if (r.amount === null || !r.date) return 'skip';
    let supplierId: string | null = null;
    if (r.ico && /^\d{6,8}$/.test(r.ico)) {
      supplierId = supCache.get(r.ico) ?? null;
      if (!supplierId) {
        const { data: sup } = await supabase.from('entities')
          .upsert({ ico: r.ico, name: r.supplierName, type: 'COMPANY', normalized_name: r.supplierName.toLowerCase() }, { onConflict: 'ico' })
          .select('id').single();
        if (sup) { supplierId = sup.id as string; supCache.set(r.ico, supplierId); }
      }
    }
    const { error } = await supabase.from('transactions').upsert({
      external_id: `MM_INV_${r.docId}`,
      source_type: 'WEB_INVOICE',
      source_url: LIST_URL,
      buyer_entity_id: buyerId,
      supplier_entity_id: supplierId,
      amount_eur: r.amount,
      date_published: r.date,
      subject: `Faktúra ${r.cislo}`,
    }, { onConflict: 'external_id' });
    return error ? 'skip' : 'wrote';
  }

  const seen = new Set<string>();
  let collected = 0, wrote = 0, skip = 0, overCount = 0;
  let totalSum = 0;
  const sample: EgovRow[] = [];

  // Default poradie CORA = najnovšie faktúry na strane 1 → ideme od 1 dopredu cez page-next.
  for (let p = 1; p <= MAX_PAGES; p++) {
    let rows: EgovRow[];
    try { rows = await readPage(page); } catch { console.log(`\n  (čítanie strany ${p} zlyhalo — skúšam ďalšiu)`); if (!(await goNextPage(page))) break; continue; }

    for (const r of rows) {
      if (seen.has(r.docId)) continue;
      seen.add(r.docId);
      // IČO ťaháme z detailu LEN pre faktúry nad prahom (cross-check s CRZ).
      if ((r.amount || 0) >= MIN_AMOUNT_FOR_ICO) {
        try { r.ico = await fetchIco(page, r.docId); if (r.ico) r.ico = correctIco(r.ico) ?? r.ico; } catch { r.ico = null; }
        overCount++;
        if (sample.length < 12 && r.ico) sample.push(r);
      }
      collected++;
      totalSum += r.amount || 0;
      if (APPLY) { const res = await persist(r); if (res === 'wrote') wrote++; else skip++; }
    }
    process.stdout.write(`\r  strana ${p}/${MAX_PAGES} — zozbieraných ${collected}, nad prahom ${overCount}${APPLY ? `, zapísaných ${wrote}` : ''}`);
    if (p < MAX_PAGES) { if (!(await goNextPage(page))) { console.log('\n  (koniec stránkovania)'); break; } }
  }
  console.log('');
  await browser.close();

  console.log(`\n📊 Spolu ${collected} faktúr, objem ${totalSum.toLocaleString('sk-SK', { minimumFractionDigits: 2 })} €`);
  console.log(`   Faktúr nad ${MIN_AMOUNT_FOR_ICO} € (s IČO z detailu): ${overCount}`);
  console.log(`\n🔎 Vzorka nad prahom:`);
  sample.forEach(r => console.log(`   ${(r.amount || 0).toLocaleString('sk-SK', { minimumFractionDigits: 2 }).padStart(13)} € | ${r.date} | ${r.supplierName} (${r.ico || 'bez IČO'})`));

  if (!APPLY) { console.log(`\n✅ DRY-RUN hotový. Pre zápis --apply.`); return; }

  console.log(`\n🎉 Hotovo: zapísaných ${wrote}, preskočených ${skip}.`);
  await supabase.from('system_logs').insert({ source: 'EGOV_SCRAPER', message: `eGOV Martin: ${wrote} faktúr zapísaných (${MAX_PAGES} strán od najnovších).`, parsed_data: { wrote, skip, totalSum, overCount } });
}
main().then(() => process.exit(0)).catch(e => { console.error('CHYBA:', e); process.exit(1); });
