// READ-ONLY: entities + transactions for suspicious ICO batch 280-314
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const ICOS = ['52417751','53053800','53457919','55477232','57177392','64833186','87110170'];
(async () => {
  const { data: ents, error } = await supabase.from('entities').select('id,name,ico,type').in('ico', ICOS);
  if (error) { console.log('ERR', error.message); return; }
  console.log('ENTITIES:', JSON.stringify(ents));
  const out = [];
  for (const e of ents || []) {
    let from = 0; const txs = [];
    while (true) {
      const { data } = await supabase.from('transactions').select('id,title,supplier_id,customer_name,amount_eur,date_published,source_type,source_id,source_url').eq('supplier_id', e.id).range(from, from + 999);
      txs.push(...(data || []));
      if (!data || data.length < 1000) break;
      from += 1000;
    }
    out.push({ entity: e, txs });
    console.log(`=== ${e.ico} ${e.name} (${txs.length} tx)`);
    for (const t of txs.slice(0, 12)) console.log(JSON.stringify(t));
  }
  fs.writeFileSync('.audit/DV-ICO-ALL_suspects_tx_280.json', JSON.stringify(out, null, 1));
})();
