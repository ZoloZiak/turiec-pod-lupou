// READ-ONLY: entita Obec Nolčovo (ico 00216822) + jej transakcie + counterparty.
require('dotenv').config({ path: '.env.local' });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  // entity s ico 00216822 aj 00316822
  for (const ico of ['00216822', '00316822']) {
    const { data: ents } = await supabase.from('entities').select('*').eq('ico', ico);
    console.log(`\n=== entities ico=${ico}: ${ents ? ents.length : 0} ===`);
    (ents || []).forEach(e => console.log(JSON.stringify(e)));
  }
  // entity name obsahuje Nolčovo
  const { data: byname } = await supabase.from('entities').select('*').ilike('name', '%Nol%ovo%');
  console.log(`\n=== entities name~Nolčovo: ${byname ? byname.length : 0} ===`);
  (byname || []).forEach(e => console.log(JSON.stringify(e)));

  // transakcie kde figuruje 00216822 (ako entity_ico/counterparty_ico) + textové polia
  // najprv zistíme stĺpce transactions
  const { data: t1 } = await supabase.from('transactions').select('*').limit(1);
  console.log('\n=== transactions KEYS ===');
  console.log(JSON.stringify(Object.keys(t1[0] || {})));

  // vyhľadaj tx podľa entity id (00216822)
  const { data: entWrong } = await supabase.from('entities').select('id, name, ico').eq('ico', '00216822');
  for (const e of (entWrong || [])) {
    const { data: tx1 } = await supabase.from('transactions').select('id, crz_id, source_url, amount_eur, description, entity_id, counterparty_name, counterparty_ico, created_at').eq('entity_id', e.id);
    console.log(`\n=== tx entity_id=${e.id} (${e.name}): ${tx1 ? tx1.length : 0} ===`);
    (tx1 || []).forEach(t => console.log(JSON.stringify(t)));
  }
})().catch(e => console.log('FATAL: ' + e.message));
