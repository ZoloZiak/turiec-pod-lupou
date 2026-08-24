// READ-ONLY: tx pre 5 sporných entít dávky 280-314 (správne stĺpce)
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const IDS = {
  '52417751': '54a71ebf-70e1-496d-8bd1-434a03b35659',
  '53053800': 'bdcf5ab5-4b5e-4097-b635-2e57999fde64',
  '53457919': '07b4c37a-ce15-49dc-9115-94d4a341ea30',
  '55477232': '91bcebc9-a3a7-4eb3-b1dd-47561490605e',
  '57177392': 'c69cd693-36c7-4166-b80d-531b79b58545',
};
(async () => {
  for (const [ico, id] of Object.entries(IDS)) {
    const { data, error } = await supabase.from('transactions').select('id,subject,amount_eur,date_published,source_type,external_id,source_url').or(`supplier_entity_id.eq.${id},buyer_entity_id.eq.${id}`);
    if (error) { console.log(`=== ${ico} ERROR: ${error.message}`); continue; }
    console.log(`=== ${ico} (${data.length} tx)`);
    for (const t of data) console.log(JSON.stringify(t));
  }
})();
