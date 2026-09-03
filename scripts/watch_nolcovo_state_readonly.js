// READ-ONLY: overenie stavu Obec Nolcovo po WATCH #68 (commit 1e494fc).
// Kontroluje: (a) ci sa orphan ICO 00216822 znova nezalozil (recidiva #4),
// (b) ci crz_12502992 sedi na spravnej entite 00316822.
// Nic nemeni.
require('dotenv').config({ path: '.env.local' });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function run() {
  for (const ico of ['00216822', '00316822']) {
    const { data, error } = await supabase.from('entities').select('*').eq('ico', ico);
    if (error) { console.log(`entities ico=${ico}: CHYBA ${error.message}`); continue; }
    console.log(`\n=== entities ico=${ico}: ${data.length} entit ===`);
    for (const e of data) console.log('  ' + JSON.stringify({ id: e.id, name: e.name, ico: e.ico, type: e.type, created_at: e.created_at }));
  }
  // crz_12502992 - kam ukazuju strany
  const { data: tx, error: terr } = await supabase.from('transactions')
    .select('*').eq('external_id', 'crz_12502992');
  if (terr) { console.log('tx CHYBA ' + terr.message); return; }
  console.log(`\n=== transactions external_id=crz_12502992: ${tx.length} ===`);
  for (const t of tx) console.log('  ' + JSON.stringify({ id: t.id, external_id: t.external_id, buyer_ico: t.buyer_ico, supplier_ico: t.supplier_ico, amount_eur: t.amount_eur, description: t.description }));
}
run();
