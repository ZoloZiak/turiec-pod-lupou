// READ-ONLY WATCH #145: čistý tx dopad 3 "Adam Ďurica" entít + kolízia IČO.
// Cieľ: rozuzliť či 87110170 (RPO 0, vyzerá ako preklep/duplicita) je orphan alebo drží tx,
// a či ho isValidIco pustí na web ako funkčný register-link na neexistujúci subjekt.
require('dotenv').config({ path: '.env.local' });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const ENTS = [
  { id: '715bafc4-3d81-48f1-ba4d-1e44674226db', ico: '87110170', label: 'Adam Ďurica (RPO 0, podozrivé)' },
  { id: 'c3e7e392-de2c-4d3f-9815-8481bc0e90b7', ico: '53995031', label: 'Adam Ďurica (RPO OK)' },
  { id: '8ed34cf4-9613-4f05-b2fb-5c6fdb607cd3', ico: 'NO_ICO_ADAMURICA', label: 'Adam Ďurica (name-fallback)' },
];

async function full(entId, col) {
  // presný count aj skutočné riadky (bez 1000-cap dôvery)
  const { count } = await sb.from('transactions').select('*', { count: 'exact', head: true }).eq(col, entId);
  let rows = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await sb.from('transactions').select('id,source_url,source_type,amount_eur,created_at,description').eq(col, entId).range(from, from + 999);
    if (!data || !data.length) break;
    rows = rows.concat(data);
    if (data.length < 1000) break;
  }
  return { count: count || 0, rows };
}

(async () => {
  for (const e of ENTS) {
    const b = await full(e.id, 'buyer_entity_id');
    const s = await full(e.id, 'supplier_entity_id');
    console.log('\n== ' + e.ico + ' | ' + e.label + ' | ent=' + e.id);
    console.log('   asBuyer count=' + b.count + ' rows=' + b.rows.length + ' | asSupplier count=' + s.count + ' rows=' + s.rows.length);
    for (const t of [...b.rows, ...s.rows]) {
      console.log('   tx=' + t.id + ' ' + t.source_type + ' ' + t.source_url + ' amt=' + t.amount_eur + ' at=' + t.created_at);
      console.log('      desc: ' + (t.description || '').slice(0, 90));
    }
  }
})();
