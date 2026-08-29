// READ-ONLY: najdi realne eurofondove/NFP/Plan obnovy zmluvy v transactions,
// aj s buyer/supplier entitami. Pochop semantiku pred naplnenim eu_funds.
require('dotenv').config({ path: '.env.local' });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);
async function fetchAll(table, cols) {
  let all = [], from = 0, page = 1000;
  for (;;) {
    const { data, error } = await supabase.from(table).select(cols).range(from, from+page-1);
    if (error) throw error;
    all = all.concat(data||[]);
    if (!data || data.length < page) break;
    from += page;
  }
  return all;
}
async function run() {
  const tx = await fetchAll('transactions','id,subject,amount_eur,source_url,external_id,date_published,buyer_entity_id,supplier_entity_id');
  const ents = await fetchAll('entities','id,name,ico,type');
  const eById = new Map(ents.map(e=>[e.id,e]));
  const re = /nen[aá]vratn|NFP|Z40120|Pl[aá]n obnovy|eurofond|ITMS|europsk|EFRR|kohézn|Z[0-9]{6}/i;
  const hits = tx.filter(t=>t.subject && re.test(t.subject)).sort((a,b)=>(Number(b.amount_eur)||0)-(Number(a.amount_eur)||0));
  console.log(`NFP/eurofond kandidatov: ${hits.length}\n`);
  for (const h of hits.slice(0,30)) {
    const b = eById.get(h.buyer_entity_id), s = eById.get(h.supplier_entity_id);
    console.log(`${h.external_id} | ${(Number(h.amount_eur)||0).toLocaleString('sk')} EUR | ${h.date_published}`);
    console.log(`   PREDMET: ${(h.subject||'').replace(/&quot;/g,'"').slice(0,100)}`);
    console.log(`   BUYER(prijemca): ${b?b.name+' ['+b.ico+']':h.buyer_entity_id}`);
    console.log(`   SUPPLIER(zdroj):  ${s?s.name+' ['+s.ico+']':h.supplier_entity_id}`);
  }
}
run().catch(e=>console.log('FATAL',e.message));
