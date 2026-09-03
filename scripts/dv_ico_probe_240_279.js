// READ-ONLY probe: txs for suspicious entities
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
(async () => {
  const { data: ents } = await sb.from('entities').select('id,ico,name').in('ico', ['51690551', '52219763']);
  const out = [];
  for (const e of ents || []) {
    let from = 0;
    for (;;) {
      const { data: txs } = await sb.from('transactions').select('id, counterparty_name, amount_eur, source_type, source_id, source_url, entity_id').eq('entity_id', e.id).range(from, from + 999);
      if (!txs || !txs.length) break;
      out.push(...txs.map(t => ({ ...t, ent_ico: e.ico, ent_name: e.name })));
      if (txs.length < 1000) break;
      from += 1000;
    }
  }
  fs.writeFileSync('/tmp/dv_ico_suspicious.json', JSON.stringify(out, null, 1));
  console.log(JSON.stringify(out.map(t => ({ ico: t.ent_ico, name: t.counterparty_name, amt: t.amount_eur, st: t.source_type, sid: t.source_id, url: t.source_url })), null, 1));
})();
