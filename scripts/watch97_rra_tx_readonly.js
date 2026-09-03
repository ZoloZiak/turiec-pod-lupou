// READ-ONLY WATCH #97: dohľadaj tx crz_9000484 (RRA↔TVS) a kanon 52478424.
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '/Users/ziak.z/projects/turiec-pod-lupou/.env.local' });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

(async () => {
  // tx pre crz 9000484 (podľa ext_id alebo source_url)
  const { data: tx } = await sb.from('transactions')
    .select('id, ext_id, amount_eur, description, source_url, supplier_id, buyer_id')
    .or('ext_id.ilike.%9000484%,source_url.ilike.%9000484%');
  console.log('== tx pre 9000484 ==', (tx||[]).length);
  for (const t of (tx||[])) {
    console.log(JSON.stringify(t));
    for (const fld of ['supplier_id','buyer_id']) {
      if (t[fld]) {
        const { data: e } = await sb.from('entities').select('id, ico, name').eq('id', t[fld]).maybeSingle();
        console.log(`   ${fld} ->`, JSON.stringify(e));
      }
    }
  }
  // existuje kanon 52478424?
  const { data: canon } = await sb.from('entities').select('id, ico, name').eq('ico', '52478424');
  console.log('== kanon 52478424 v DB ==', JSON.stringify(canon));
  // existuje niekto s IČO 47431563 (bez medzery, TerramPro strip)?
  const { data: strip } = await sb.from('entities').select('id, ico, name').eq('ico', '47431563');
  console.log('== strip 47431563 v DB ==', JSON.stringify(strip));
})();
