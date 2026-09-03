// WATCH: finálne overenie exclusion-listy 12 duplicitných CRZ nôh (keyed on external_id).
// Potvrdí: (a) 12 non-kanonických external_id existuje v DB, ich amount + INCOME membership,
//          (b) 10 kanonických (ponechaných) external_id existuje a je INCOME,
//          (c) nový hero income po vylúčení 12 == očakávaných 41 673 507,79.
// READ-ONLY. Zoznam je 2-zdrojovo overený proti CRZ (NFP ref + suma + oba IČO strán).
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const PAGE = 1000;
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g;
function loadIncomeIds() {
  const src = fs.readFileSync('src/lib/income-ids.ts', 'utf8');
  return new Set(src.slice(src.indexOf('new Set<string>([')).match(UUID_RE) || []);
}

// 12 NON-KANONICKÝCH (na vylúčenie) — mladšie/neskôr publikované nohy dup skupín
const DUP = [
  'crz_9069830', 'crz_8952736',   // IROP-Z-302041M829-421-19  6 629 481,99  (keep crz_8925478)
  'crz_11640021',                 // 401202F311                1 993 880,20  (keep crz_11631193)
  'crz_8676398', 'crz_8646928',   // IROP-Z-302041BDF7-431-65    572 413,74  (keep crz_8629437)
  'crz_10782440',                 // 401202FKH7                  627 404,07  (keep crz_10777804)
  'crz_9940951',                  // Z401101FKB8                 487 225,70  (keep crz_9936715)
  'crz_11069857',                 // 401402B928                  385 701,83  (keep crz_11065056)
  'crz_7681397',                  // IROP-Z-302021W253-211-34    355 569,42  (keep crz_7674173)
  'crz_11437844',                 // NFP č. 1374/2025            344 819,40  (keep crz_11424107)
  'crz_8061781',                  // IROP-Z-302071CVB9-76-98 zml 175 116,00  (keep crz_8058128)
  'crz_9289098',                  // IROP-Z-302071CVB9-76-98 dod 160 356,00  (keep crz_9286569)
];
const KEEP = ['crz_8925478','crz_11631193','crz_8629437','crz_10777804','crz_9936715','crz_11065056','crz_7674173','crz_11424107','crz_8058128','crz_9286569'];

async function fetchAll() {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from('transactions')
      .select('id, external_id, source_type, amount_eur, subject')
      .order('id', { ascending: true }).range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < PAGE) break;
  }
  return rows;
}

async function main() {
  const INCOME = loadIncomeIds();
  const rows = await fetchAll();
  const byExt = new Map(rows.map(r => [r.external_id, r]));
  console.log('total rows =', rows.length);

  console.log('\n=== 12 NON-KANONICKÝCH (na vylúčenie) ===');
  let dupSum = 0, dupIncome = 0, dupMissing = 0;
  const uuids = [];
  for (const ext of DUP) {
    const r = byExt.get(ext);
    if (!r) { console.log(`  ${ext}: NENÁJDENÉ V DB`); dupMissing++; continue; }
    const amt = Number(r.amount_eur) || 0;
    const isInc = INCOME.has(r.id);
    dupSum += amt; if (isInc) dupIncome += amt;
    uuids.push(r.id);
    console.log(`  ${ext} | uuid=${r.id} | amt=${amt.toFixed(2)} | INCOME=${isInc} | ${(r.subject||'').slice(0,55)}`);
  }
  console.log(`  => spolu ${DUP.length}, chýbajúcich ${dupMissing}, suma ${dupSum.toFixed(2)}, z toho INCOME ${dupIncome.toFixed(2)}`);

  console.log('\n=== 10 KANONICKÝCH (ponechané) ===');
  let keepMissing = 0, keepNonIncome = 0;
  for (const ext of KEEP) {
    const r = byExt.get(ext);
    if (!r) { console.log(`  ${ext}: NENÁJDENÉ (POZOR — kanonický musí existovať!)`); keepMissing++; continue; }
    const isInc = INCOME.has(r.id);
    if (!isInc) keepNonIncome++;
    console.log(`  ${ext} | uuid=${r.id} | amt=${(Number(r.amount_eur)||0).toFixed(2)} | INCOME=${isInc}`);
  }

  // Prepočet hero income pred/po
  let incRaw = 0;
  for (const r of rows) if (INCOME.has(r.id)) incRaw += Number(r.amount_eur) || 0;
  const dupExtSet = new Set(DUP);
  let incAfter = 0;
  for (const r of rows) if (INCOME.has(r.id) && !dupExtSet.has(r.external_id)) incAfter += Number(r.amount_eur) || 0;

  console.log('\n=== HERO INCOME ===');
  console.log('  raw (dnes)          =', incRaw.toFixed(2));
  console.log('  po vylúčení 12      =', incAfter.toFixed(2));
  console.log('  rozdiel             =', (incRaw - incAfter).toFixed(2), '(očak. 18933864.08)');
  console.log('\nuuids na dokumentáciu:', JSON.stringify(uuids));
  console.log('\nVALIDÁCIA:', (dupMissing === 0 && keepMissing === 0 && Math.abs((incRaw - incAfter) - 18933864.08) < 0.5)
    ? 'OK — všetkých 12 existuje, 10 kanonických existuje, rozdiel sedí' : 'POZOR — over vyššie');
}
main().catch(e => { console.error('FATAL', e.message); process.exit(1); });
