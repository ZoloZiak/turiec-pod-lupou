// READ-ONLY: vytiahni realne external_id + source_url pre prepojene tx (per slub).
require('dotenv').config({ path: '.env.local' });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);
async function run() {
  const { data: promises } = await supabase.from('promises').select('title,related_transaction_ids').order('title');
  for (const p of promises) {
    const ids = p.related_transaction_ids || [];
    if (!ids.length) continue;
    const { data: txs } = await supabase.from('transactions').select('id,external_id,source_url,amount_eur,subject').in('id', ids);
    console.log(`\n## ${p.title}`);
    for (const t of (txs||[])) {
      console.log(`${t.external_id} | ${t.source_url} | ${(Number(t.amount_eur)||0)} | ${(t.subject||'').replace(/&quot;/g,'"').slice(0,60)}`);
    }
  }
}
run().catch(e=>console.log('FATAL',e.message));
