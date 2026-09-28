// READ-ONLY WATCH #253b: presný tx count + created_at pre obe Nolčovo entity.
// Rozhodne update-vs-merge-vs-delete pre chybnú orphan entitu 00216822.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const BAD_ID = '1196e02c-92e4-48f0-a91a-5e9eeddb2603';   // ico 00216822 (chybné)
const GOOD_ID = 'fd5a0373-91fa-45cf-a921-a8efb7f3efa5';  // ico 00316822 (správne)

async function txCount(field, id) {
  const { count, error } = await sb.from('transactions').select('id', { count: 'exact', head: true }).eq(field, id);
  return error ? ('ERR:' + error.message) : count;
}

(async () => {
  // full entity rows (all columns) pre created_at a ďalšie polia
  const { data: rows, error } = await sb.from('entities').select('*').in('id', [BAD_ID, GOOD_ID]);
  if (error) { console.log('ent err', error.message); return; }
  for (const r of rows) console.log('ENT', JSON.stringify(r));

  for (const [label, id] of [['BAD 00216822', BAD_ID], ['GOOD 00316822', GOOD_ID]]) {
    const s = await txCount('supplier_id', id);
    const b = await txCount('buyer_id', id);
    console.log(`${label} (${id}): supplier_tx=${s} buyer_tx=${b}`);
  }
})().catch(e => console.log('FATAL: ' + e.message));
