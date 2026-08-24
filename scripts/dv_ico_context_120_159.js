// READ-ONLY: kontext pre sporné IČO z dávky 120-159
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const ICOS = ['36399124', '36399728', '36437141'];
(async () => {
  const { data: ents } = await supabase.from('entities').select('id,name,ico,type').in('ico', ICOS);
  console.log('ENTITIES:', JSON.stringify(ents, null, 1));
  for (const e of ents || []) {
    const { data: txs } = await supabase.from('transactions').select('id,title,supplier_id,amount_eur,date_published,source_type,source_url').eq('supplier_id', e.id).limit(10);
    console.log(`TX for ${e.ico} (${e.name}):`, JSON.stringify(txs, null, 1));
    // aj ako odberatel?
    const { data: txs2 } = await supabase.from('transactions').select('id,title,customer_name,amount_eur,date_published,source_url').eq('customer_name', e.name).limit(5);
    if (txs2 && txs2.length) console.log(`TX customer_name match:`, JSON.stringify(txs2, null, 1));
  }
})();
