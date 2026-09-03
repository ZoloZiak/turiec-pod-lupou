// WATCH #86 READ-ONLY: resolve promises.related_transaction_ids -> full tx detail (spravna schema)
require('dotenv').config({ path: '.env.local' });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);
async function run() {
  const { data: promises } = await supabase
    .from('promises').select('title,status,related_transaction_ids').order('title');
  const allIds = [];
  for (const p of promises) for (const id of (p.related_transaction_ids || [])) allIds.push(id);
  const txById = {};
  const entIds = new Set();
  for (let i = 0; i < allIds.length; i += 100) {
    const chunk = allIds.slice(i, i + 100);
    const { data: txs, error } = await supabase.from('transactions')
      .select('id,external_id,subject,amount_eur,buyer_entity_id,supplier_entity_id,source_url,date_published')
      .in('id', chunk);
    if (error) { console.log('TX ERR', error.message); }
    for (const t of (txs || [])) { txById[t.id] = t; if(t.buyer_entity_id)entIds.add(t.buyer_entity_id); if(t.supplier_entity_id)entIds.add(t.supplier_entity_id); }
  }
  // resolve entities
  const ent = {};
  const eArr = [...entIds];
  for (let i=0;i<eArr.length;i+=100){
    const chunk=eArr.slice(i,i+100);
    const { data } = await supabase.from('entities').select('id,name,ico').in('id',chunk);
    for (const e of (data||[])) ent[e.id]=e;
  }
  const nm = id => { const e=ent[id]; return e?`${e.name} (${e.ico||'-'})`:'-'; };
  for (const p of promises) {
    const ids = p.related_transaction_ids || [];
    if (!ids.length) { console.log(`\n=== ${p.title} [${p.status}] — 0 vazieb`); continue; }
    let sum = 0;
    console.log(`\n=== ${p.title} [${p.status}] — ${ids.length} vazieb`);
    for (const id of ids) {
      const t = txById[id];
      if (!t) { console.log(`  !! MISSING tx id=${id}`); continue; }
      sum += Number(t.amount_eur) || 0;
      console.log(`  ${t.external_id} | ${(Number(t.amount_eur)||0).toFixed(2)} EUR | ${t.date_published}`);
      console.log(`     obj: ${nm(t.buyer_entity_id)}  <-  dod: ${nm(t.supplier_entity_id)}`);
      console.log(`     subj: ${(t.subject||'').slice(0,120)}`);
      console.log(`     url: ${t.source_url||'-'}`);
    }
    console.log(`  SUM = ${sum.toFixed(2)} EUR`);
  }
}
run().catch(e => console.log('FATAL', e.message));
