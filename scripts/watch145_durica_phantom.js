// READ-ONLY WATCH #145: rozuzli count=1 vs rows=0 fantóm pre 87110170 supplier.
require('dotenv').config({ path: '.env.local' });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const ENT = '715bafc4-3d81-48f1-ba4d-1e44674226db';

(async () => {
  // 1) plain select, žiadny range
  const { data: plain, error: e1 } = await sb.from('transactions').select('*').eq('supplier_entity_id', ENT);
  console.log('plain select supplier_entity_id=ENT -> rows=' + (plain ? plain.length : 'null') + ' err=' + (e1 ? e1.message : 'none'));
  for (const t of (plain || [])) console.log('  tx=' + t.id + ' src=' + t.source_url + ' amt=' + t.amount_eur + ' at=' + t.created_at + ' buyer=' + t.buyer_entity_id + ' supplier=' + t.supplier_entity_id + ' desc=' + (t.description || '').slice(0, 60));

  // 2) count exact znova
  const { count, error: e2 } = await sb.from('transactions').select('*', { count: 'exact', head: true }).eq('supplier_entity_id', ENT);
  console.log('\ncount exact = ' + count + ' err=' + (e2 ? e2.message : 'none'));

  // 3) je ENT id niekde ako buyer?
  const { data: asb } = await sb.from('transactions').select('id,source_url,amount_eur,description').eq('buyer_entity_id', ENT);
  console.log('as buyer plain -> rows=' + (asb ? asb.length : 'null'));
  for (const t of (asb || [])) console.log('  tx=' + t.id + ' ' + t.source_url + ' amt=' + t.amount_eur + ' | ' + (t.description || '').slice(0, 60));
})();
