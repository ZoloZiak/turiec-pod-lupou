// WATCH #265 READ-ONLY: reconciliacia Brantner Fatra 31578861 (supplier profile).
// Porovna produkcnu /api/supplier odpoved (stats) vs RAW DB paginovany sucet.
// Nic nemeni.
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const PAGE = 1000;
const ICO = '31578861';

async function main() {
  // produkcia
  const prod = JSON.parse(fs.readFileSync('/tmp/sup_brantner.json', 'utf8'));
  const stats = prod.stats || {};
  console.log('=== WATCH265 Brantner recon (READ-ONLY) ===');
  console.log('PROD stats: totalCount=' + stats.totalCount + ' totalAmount=' + stats.totalAmount);
  console.log('PROD tx v odpovedi: ' + (prod.transactions || []).length);

  // najdi entity id podla ico
  const { data: ents } = await supabase.from('entities').select('id, name, ico').eq('ico', ICO);
  console.log('entity match ico=' + ICO + ': ' + JSON.stringify(ents));
  const eid = ents && ents[0] && ents[0].id;
  if (!eid) { console.log('NENASIEL ENTITU'); return; }

  // raw paginovany sucet supplier_entity_id
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from('transactions')
      .select('id, amount_eur')
      .eq('supplier_entity_id', eid)
      .range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < PAGE) break;
  }
  let sum = 0;
  rows.forEach(t => { sum += Number(t.amount_eur) || 0; });
  console.log('RAW DB: count=' + rows.length + ' amount=' + sum.toFixed(2));

  const cMatch = stats.totalCount === rows.length;
  const sMatch = Math.abs((stats.totalAmount || 0) - sum) < 0.01;
  console.log('MATCH count=' + cMatch + '  MATCH sum=' + sMatch);
  console.log('=== koniec ===');
}
main().catch(e => { console.error('FATAL', e.message); process.exit(1); });
