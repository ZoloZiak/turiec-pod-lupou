// READ-ONLY: inspect transactions for suspicious ICOs of batch 160-199
require('dotenv').config({ path: '/Users/ziak.z/projects/turiec-pod-lupou/.env.local' });
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const ICOS = ['36798087', '37806939', '43841121', '44331452'];
(async () => {
  const out = {};
  const { data: ents, error } = await sb.from('entities').select('id,name,ico').in('ico', ICOS);
  if (error) { console.log('ERR ' + error.message); return; }
  for (const e of ents) {
    const { data, error: txErr } = await sb.from('transactions').select('id,subject,amount_eur,source_type,source_url,external_id,supplier_entity_id,buyer_entity_id').or(`supplier_entity_id.eq.${e.id},buyer_entity_id.eq.${e.id}`).limit(20);
    out[e.ico] = { entity: e, txCount: data ? data.length : txErr.message, txs: data };
  }
  console.log(JSON.stringify(out, null, 2));
})();
