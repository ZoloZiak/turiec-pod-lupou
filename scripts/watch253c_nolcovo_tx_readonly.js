// READ-ONLY WATCH #253c(fix): priame fetchnutie tx pre obe Nolčovo entity.
// Správne FK stĺpce = buyer_entity_id / supplier_entity_id.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const BAD_ID = '1196e02c-92e4-48f0-a91a-5e9eeddb2603';   // ico 00216822 (chybné)
const GOOD_ID = 'fd5a0373-91fa-45cf-a921-a8efb7f3efa5';  // ico 00316822 (správne)

async function txFor(id) {
  const asSup = await sb.from('transactions').select('id, amount_eur, subject, source_url, date_published').eq('supplier_entity_id', id);
  const asBuy = await sb.from('transactions').select('id, amount_eur, subject, source_url, date_published').eq('buyer_entity_id', id);
  return { supErr: asSup.error && asSup.error.message, sup: asSup.data || [], buyErr: asBuy.error && asBuy.error.message, buy: asBuy.data || [] };
}

(async () => {
  for (const [label, id] of [['BAD 00216822', BAD_ID], ['GOOD 00316822', GOOD_ID]]) {
    const r = await txFor(id);
    console.log(`${label} (${id}): supplier_tx=${r.sup.length} buyer_tx=${r.buy.length} supErr=${r.supErr || '-'} buyErr=${r.buyErr || '-'}`);
    for (const t of r.sup.slice(0, 8)) console.log('   SUP', JSON.stringify(t));
    for (const t of r.buy.slice(0, 8)) console.log('   BUY', JSON.stringify(t));
  }
})().catch(e => console.log('FATAL: ' + e.message));
