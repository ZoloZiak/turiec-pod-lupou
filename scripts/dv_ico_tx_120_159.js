// READ-ONLY: transakcie pre sporné entity z dávky 120-159
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const IDS = ['e6fc9e05-9612-404e-8d38-9eab79b9530b', '74e9276f-0b83-43db-a9d1-a70dacd3dc6c', '969abe99-42c8-4d0a-a844-c8e524482f68'];
(async () => {
  for (const id of IDS) {
    const { data, error } = await supabase.from('transactions')
      .select('id,amount_eur,date_published,source_type,source_url,supplier_entity_id,buyer_entity_id')
      .or(`supplier_entity_id.eq.${id},buyer_entity_id.eq.${id}`)
      .limit(10);
    console.log(id, '->', JSON.stringify(data, null, 1), error ? error.message : '');
  }
})();
