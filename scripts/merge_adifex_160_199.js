// MERGE: zlá entita Adfex 36798087 -> existujúca Adifex, a. s. 46715894. Idempotentný, dry-run default.
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const APPLY = process.argv.includes('--apply');
const BAD_ID = 'a8ab1cab-fc3b-498a-a107-554fd0999b03'; // Adfex, a.s. 36798087
const GOOD_ID = '04691469-39d6-40d0-b473-9e4b1922649e'; // Adifex, a. s. 46715894
(async () => {
  const { count: badCount } = await supabase.from('transactions').select('id', { count: 'exact', head: true }).or(`supplier_entity_id.eq.${BAD_ID},buyer_entity_id.eq.${BAD_ID}`);
  console.log(`zlá entita má ${badCount} tx`);
  if (badCount === 0) { console.log('nič na merge — entita bez tx, len by sa zmazala'); return; }
  console.log(`${APPLY ? 'APPLY' : 'DRY'} presúvam ${badCount} tx na ${GOOD_ID}`);
  if (APPLY) {
    const { error: e1 } = await supabase.from('transactions').update({ supplier_entity_id: GOOD_ID }).eq('supplier_entity_id', BAD_ID);
    if (e1) { console.log('ERROR tx:', e1.message); return; }
    const { error: e2 } = await supabase.from('transactions').update({ buyer_entity_id: GOOD_ID }).eq('buyer_entity_id', BAD_ID);
    if (e2) { console.log('ERROR tx2:', e2.message); return; }
    // guard pred delete
    const { count: after } = await supabase.from('transactions').select('id', { count: 'exact', head: true }).or(`supplier_entity_id.eq.${BAD_ID},buyer_entity_id.eq.${BAD_ID}`);
    if (after !== 0) { console.log(`STOP: po presune ostalo ${after} tx na zlej entite — nemažem.`); return; }
    const { error: e3 } = await supabase.from('entities').delete().eq('id', BAD_ID);
    console.log(e3 ? 'ERROR del: ' + e3.message : 'OK: entita zmazaná');
  }
})();
