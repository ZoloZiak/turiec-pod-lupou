// READ-ONLY WATCH #145: presný source_url + kontext jedinej supplier tx entity 87110170 "Adam Ďurica"
require('dotenv').config({ path: '.env.local' });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const ENT = '715bafc4-3d81-48f1-ba4d-1e44674226db';

(async () => {
  const { data: tx } = await sb.from('transactions')
    .select('id,source_url,source_type,amount_eur,created_at,description,buyer_entity_id,supplier_entity_id')
    .eq('supplier_entity_id', ENT);
  console.log('supplier tx count: ' + (tx ? tx.length : 0));
  for (const t of (tx || [])) {
    console.log(JSON.stringify(t, null, 2));
    // kto je buyer?
    if (t.buyer_entity_id) {
      const { data: b } = await sb.from('entities').select('ico,name').eq('id', t.buyer_entity_id);
      console.log('  BUYER: ' + JSON.stringify(b && b[0]));
    }
  }
  // je 87110170 aj inde? (ako string v source)
  console.log('\n-- ďalšie entity s podobným menom "Adam Ďurica" --');
  const { data: dur } = await sb.from('entities').select('id,ico,name').ilike('name', '%urica%');
  for (const d of (dur || [])) console.log('  ' + d.ico + ' | ' + d.name + ' | ' + d.id);
})();
