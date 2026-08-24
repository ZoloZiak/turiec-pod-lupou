// READ-ONLY diag: transactions pre podozrivé IČO z dávky 40-79
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const SUSPECTS = ['15030865', '15547591', '27427889', '31385915', '31386563', '22664980', '30794536', '10734180'];
(async () => {
  const { data: ents, error } = await supabase.from('entities').select('id,name,ico').in('ico', SUSPECTS);
  if (error) { console.error(error.message); return; }
  const out = {};
  for (const e of ents) {
    const { data: txs, error: txErr } = await supabase.from('transactions')
      .select('id,subject,amount_eur,source_type,source_url,external_id,supplier_entity_id,buyer_entity_id')
      .or(`supplier_entity_id.eq.${e.id},buyer_entity_id.eq.${e.id}`);
    if (txErr) { console.error(e.ico, txErr.message); continue; }
    out[e.ico] = { entity: e, txCount: txs.length, txs };
  }
  console.log(JSON.stringify(out, null, 1));
})();
