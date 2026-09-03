// WATCH #71 stráž (READ-ONLY): kvantifikuj dopad chýbajúcej deduplikácie na /upozornenia.
// /upozornenia/page.tsx číta transactions PRIAMO zo Supabase a NEimportuje duplicate-ids.ts,
// takže dedup fix WATCH #66/#67 (aplikovaný v /api/data + /api/supplier) sa tu NEUPLATŇUJE.
// Zoznam "Zákazky nad 100k (Kontrola RPVS)" tak môže ukazovať tú istú zmluvu 2-3x.
// Tento skript replikuje presne server-side logiku page.tsx a porovná RAW vs DEDUP.
// Kľúč (external_id) číta priamo zo src/lib/duplicate-ids.ts nech sedí s produkciou. NIČ nemení.
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const PAGE = 1000;

function loadExclusionSet() {
  const src = fs.readFileSync('src/lib/duplicate-ids.ts', 'utf8');
  // vytiahni všetky "crz_<číslo>" literály z oboch Setov (income + expense)
  const ids = src.match(/"crz_\d+"/g) || [];
  return new Set(ids.map(s => s.replace(/"/g, '')));
}

async function fetchAll() {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('transactions')
      .select('id, external_id, source_type, amount_eur, subject, date_published, supplier:supplier_entity_id(name, ico)')
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < PAGE) break;
  }
  return rows;
}

async function main() {
  const EXCL = loadExclusionSet();
  console.log('exclusion set (duplicate-ids.ts) =', EXCL.size, 'external_id');
  const rows = await fetchAll();
  console.log('DB transactions (paginated) =', rows.length);

  // presne ako page.tsx: over100k = amount_eur >= 100000
  const over100kRaw = rows.filter(t => (Number(t.amount_eur) || 0) >= 100000);
  console.log('\n=== over100k RAW (tak ako to /upozornenia teraz ukazuje) ===');
  console.log('počet položiek =', over100kRaw.length);

  // ktoré z nich sú v exclusion sete = duplicitné zverejnenia zobrazené navyše
  const dupShown = over100kRaw.filter(t => t.external_id && EXCL.has(t.external_id));
  console.log('\n=== z toho DUPLICITNÉ ZVEREJNENIA (mali by byť skryté, presne ako v /api/data) ===');
  console.log('počet nadbytočných riadkov =', dupShown.length);
  let dupSum = 0;
  for (const t of dupShown) {
    dupSum += Number(t.amount_eur) || 0;
    console.log(`  ${t.external_id}  ${(Number(t.amount_eur)||0).toFixed(2)} €  ${t.supplier?.ico||'?'} ${(t.supplier?.name||'').slice(0,30)}  :: ${(t.subject||'').slice(0,60)}`);
  }
  console.log('  --- súčet nadbytočne zobrazených súm =', dupSum.toFixed(2), '€');

  const over100kDedup = over100kRaw.filter(t => !(t.external_id && EXCL.has(t.external_id)));
  console.log('\n=== over100k po DEDUP (koľko by malo reálne byť) ===');
  console.log('počet položiek =', over100kDedup.length, '(RAW', over100kRaw.length, '- dup', dupShown.length, ')');

  fs.writeFileSync('.audit/watch_alerts_dedup.json', JSON.stringify({
    exclSize: EXCL.size, totalRows: rows.length,
    over100kRaw: over100kRaw.length, over100kDedup: over100kDedup.length,
    dupShown: dupShown.map(t => ({ ext: t.external_id, amount: t.amount_eur, ico: t.supplier?.ico, name: t.supplier?.name, subject: t.subject })),
    dupSum
  }, null, 2));
  console.log('\n(uložené .audit/watch_alerts_dedup.json)');
}
main().catch(e => { console.error('FATAL', e.message); process.exit(1); });
