// READ-ONLY: presný dopad malformovaných IČO — tx cez buyer_entity_id + supplier_entity_id.
require('dotenv').config({ path: '.env.local' });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function countTx(entId) {
  const { count: bc } = await sb.from('transactions').select('*', { count: 'exact', head: true }).eq('buyer_entity_id', entId);
  const { count: sc } = await sb.from('transactions').select('*', { count: 'exact', head: true }).eq('supplier_entity_id', entId);
  return { asBuyer: bc || 0, asSupplier: sc || 0 };
}

(async () => {
  const prev = JSON.parse(fs.readFileSync('.audit/WATCH_ico_malformed_result.json', 'utf8'));
  const out = [];
  for (const r of prev) {
    const c = await countTx(r.id);
    // sample source_url zo skutočnej tx
    let sample = null;
    const { data: bs } = await sb.from('transactions').select('source_url,source_type').eq('buyer_entity_id', r.id).limit(1);
    const { data: ss } = await sb.from('transactions').select('source_url,source_type').eq('supplier_entity_id', r.id).limit(1);
    sample = (bs && bs[0]) || (ss && ss[0]) || null;
    out.push({ ...r, asBuyer: c.asBuyer, asSupplier: c.asSupplier, total_tx: c.asBuyer + c.asSupplier, sample });
  }
  out.sort((a, b) => b.total_tx - a.total_tx);
  fs.writeFileSync('.audit/WATCH_ico_malformed_impact.json', JSON.stringify(out, null, 2));
  console.log('ico | cat | asBuyer | asSupplier | total | proposal | coll | name');
  for (const r of out) {
    console.log(`"${r.ico}" | ${r.category} | B=${r.asBuyer} S=${r.asSupplier} tot=${r.total_tx} | ->${r.proposal || '?'} coll=${r.collision} | ${r.name}`);
    if (r.sample) console.log(`     src: ${r.sample.source_type} ${r.sample.source_url}`);
  }
  console.log('\nSUMA tx dotknutých malformed IČO: ' + out.reduce((a, r) => a + r.total_tx, 0));
})();
