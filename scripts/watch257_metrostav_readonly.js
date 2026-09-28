// READ-ONLY WATCH #257: over entitu(-y) "Metrostav DS a.s." a kolíziu s čistým IČO 46120602.
// Zisti: entity s ico '4612602' (typo) aj '46120602' (kanon), ich tx (buyer/supplier),
// a či existuje kolízia pre prípadný merge. NIČ nemení.
require('dotenv').config({ path: '.env.local' });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function txCount(entId) {
  const { count: b } = await sb.from('transactions').select('*', { count: 'exact', head: true }).eq('buyer_entity_id', entId);
  const { count: s } = await sb.from('transactions').select('*', { count: 'exact', head: true }).eq('supplier_entity_id', entId);
  return { asBuyer: b || 0, asSupplier: s || 0 };
}

(async () => {
  // hľadaj entity podľa mena Metrostav aj podľa oboch IČO
  const { data: byName } = await sb.from('entities').select('id,ico,name').ilike('name', '%Metrostav%');
  console.log('=== entity ilike Metrostav ===');
  for (const e of byName || []) {
    const c = await txCount(e.id);
    console.log(`id=${e.id} ico="${e.ico}" name="${e.name}" | B=${c.asBuyer} S=${c.asSupplier}`);
  }
  for (const ico of ['4612602', '46120602', '04612602']) {
    const { data } = await sb.from('entities').select('id,ico,name').eq('ico', ico);
    console.log(`\n=== entity ico == "${ico}" (${(data || []).length}) ===`);
    for (const e of data || []) {
      const c = await txCount(e.id);
      console.log(`id=${e.id} name="${e.name}" | B=${c.asBuyer} S=${c.asSupplier}`);
      // vypíš tx
      const { data: ss } = await sb.from('transactions').select('id,amount_eur,source_url,signed_date').eq('supplier_entity_id', e.id);
      for (const t of ss || []) console.log(`   S tx: ${t.id} amt=${t.amount_eur} ${t.source_url} signed=${t.signed_date}`);
    }
  }
})().catch(e => console.log('FATAL: ' + e.message));
