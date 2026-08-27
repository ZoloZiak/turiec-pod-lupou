// READ-ONLY WATCH #63: presné overenie tx pre Nolčovo entity cez REÁLNE stĺpce
// transactions (buyer_entity_id / supplier_entity_id). Predchádzajúci diag hľadal
// cez neexistujúci 'entity_id' -> falošná 0. Over orphan status novej entity 00216822.
require('dotenv').config({ path: '.env.local' });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const WRONG = '1b26fe99-62a4-4c19-8547-e069bef46cd6'; // ico 00216822 (nová orphan?)
const RIGHT = 'fd5a0373-91fa-45cf-a921-a8efb7f3efa5'; // ico 00316822 (správna)

async function txFor(id, label) {
  const { data: asBuyer, error: e1 } = await supabase.from('transactions')
    .select('id, external_id, source_url, amount_eur, subject, buyer_entity_id, supplier_entity_id, date_published, created_at')
    .eq('buyer_entity_id', id);
  const { data: asSupplier, error: e2 } = await supabase.from('transactions')
    .select('id, external_id, source_url, amount_eur, subject, buyer_entity_id, supplier_entity_id, date_published, created_at')
    .eq('supplier_entity_id', id);
  if (e1) console.log('ERR buyer', e1.message);
  if (e2) console.log('ERR supplier', e2.message);
  console.log(`\n=== ${label} (${id}) ===`);
  console.log(`  ako BUYER: ${(asBuyer || []).length} tx`);
  (asBuyer || []).forEach(t => console.log('   B ' + JSON.stringify(t)));
  console.log(`  ako SUPPLIER: ${(asSupplier || []).length} tx`);
  (asSupplier || []).forEach(t => console.log('   S ' + JSON.stringify(t)));
  return (asBuyer || []).length + (asSupplier || []).length;
}

(async () => {
  const wrongCount = await txFor(WRONG, 'WRONG ico=00216822');
  const rightCount = await txFor(RIGHT, 'RIGHT ico=00316822');
  console.log(`\n=== SUMÁR: WRONG(00216822) tx=${wrongCount}, RIGHT(00316822) tx=${rightCount} ===`);
  console.log(wrongCount === 0 ? 'WRONG je ORPHAN (0 tx) -> bezpečné zmazať (REMOVE regresie).'
    : 'WRONG má tx -> MERGE (presun na RIGHT), nie čisté delete.');
})().catch(e => console.log('FATAL: ' + e.message));
