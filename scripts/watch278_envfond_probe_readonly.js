// READ-ONLY probe: entita "Enviromentálny fond" IČO 30796491 — podklad na rozhodnutie
// o oprave preklepu v názve (Enviromentálny -> Environmentálny). Nič nemení.
require('dotenv').config({ path: '.env.local' });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  const { data: ents } = await supabase.from('entities').select('id, name, ico').eq('ico', '30796491');
  console.log('ENTITY riadky s IČO 30796491:', JSON.stringify(ents, null, 1));
  for (const e of (ents || [])) {
    const { count: asSup } = await supabase.from('transactions').select('id', { count: 'exact', head: true }).eq('supplier_entity_id', e.id);
    const { count: asBuy } = await supabase.from('transactions').select('id', { count: 'exact', head: true }).eq('buyer_entity_id', e.id);
    console.log(`  id=${e.id} name="${e.name}" -> supplier_tx=${asSup}, buyer_tx=${asBuy}`);
    // vzorka najnovších tx kde je dodávateľ, aby sme videli source (CRZ vs iné)
    const { data: tx } = await supabase.from('transactions').select('id, source_url, created_at, amount_eur').eq('supplier_entity_id', e.id).order('created_at', { ascending: false }).limit(3);
    for (const t of (tx || [])) console.log(`     tx ${t.id} | ${t.created_at} | ${t.amount_eur} € | ${t.source_url}`);
  }
  // je iná entita so správnym pravopisom "Environmentálny fond"?
  const { data: correct } = await supabase.from('entities').select('id, name, ico').ilike('name', '%nvironment%');
  console.log('Entity s "nvironment" (správny pravopis):', JSON.stringify(correct, null, 1));
})().catch(e => console.log('FATAL: ' + e.message));
