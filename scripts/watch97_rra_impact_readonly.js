// READ-ONLY WATCH #97: web-facing dopad RRA a.s. entity s cudzím IČO " 47431563".
// Zistí: entita v DB (id, ico, name), koľko transakcií (buyer alebo supplier) na ňu visí,
// a či sú viditeľné na webe. NIČ nemení.
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '/Users/ziak.z/projects/turiec-pod-lupou/.env.local' });
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const sb = createClient(url, key);

(async () => {
  // 1) nájdi entity s názvom RRA alebo s ico obsahujúcim 47431563
  const { data: ents, error: e1 } = await sb
    .from('entities')
    .select('id, ico, name')
    .or('name.ilike.%RRA%,ico.ilike.%47431563%');
  if (e1) { console.error('ent err', e1.message); process.exit(1); }
  console.log('== entity kandidáti ==');
  for (const e of ents) console.log(JSON.stringify(e));

  // 2) pre každú RRA entitu spočítaj tx (supplier_id / buyer_id)
  for (const e of ents) {
    const { count: cSup } = await sb.from('transactions').select('id', { count: 'exact', head: true }).eq('supplier_id', e.id);
    const { count: cBuy } = await sb.from('transactions').select('id', { count: 'exact', head: true }).eq('buyer_id', e.id);
    console.log(`ent id=${e.id} ico="${e.ico}" name="${e.name}" -> supplier_tx=${cSup} buyer_tx=${cBuy}`);
    if ((cSup || 0) + (cBuy || 0) > 0) {
      const { data: sample } = await sb.from('transactions')
        .select('id, ext_id, amount_eur, description, source_url, supplier_id, buyer_id')
        .or(`supplier_id.eq.${e.id},buyer_id.eq.${e.id}`).limit(5);
      for (const t of (sample || [])) console.log('   tx', JSON.stringify(t));
    }
  }
})();
