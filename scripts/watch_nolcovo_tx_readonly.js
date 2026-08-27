// READ-ONLY: tx troch entít Nolčovo cez buyer/supplier_entity_id.
require('dotenv').config({ path: '.env.local' });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const IDS = {
  'NO_ICO_OBECNOLOVO (1.8)': '3bd302cb-6ae3-4160-98e0-b072d320dec4',
  '00216822 CHYBNE (24.8)': '4f39df1b-ce38-4770-896a-d43fd11ac86a',
  '00316822 SPRAVNE (3.8)': 'fd5a0373-91fa-45cf-a921-a8efb7f3efa5',
};

(async () => {
  for (const [label, id] of Object.entries(IDS)) {
    const { data: buy } = await supabase.from('transactions').select('id, external_id, source_url, amount_eur, subject, date_published').eq('buyer_entity_id', id);
    const { data: sup } = await supabase.from('transactions').select('id, external_id, source_url, amount_eur, subject, date_published').eq('supplier_entity_id', id);
    console.log(`\n=== ${label} (${id}) ===`);
    console.log(`  ako BUYER: ${buy ? buy.length : 0}, ako SUPPLIER: ${sup ? sup.length : 0}`);
    (buy || []).forEach(t => console.log('  BUY ', JSON.stringify(t)));
    (sup || []).forEach(t => console.log('  SUP ', JSON.stringify(t)));
  }
})().catch(e => console.log('FATAL: ' + e.message));
