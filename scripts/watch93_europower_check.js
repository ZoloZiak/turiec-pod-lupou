// READ-ONLY WATCH #93: over či reálne IČO 45541329 (EUROPOWER Vrútky) už má kanon
// entitu v DB, a vypíš tx orphan entity "50 513 923 " (s medzerami) pre kontext fallbacku.
require('dotenv').config({ path: '.env.local' });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  const REAL = '45541329';
  const ORPHAN = '50 513 923 '; // presný DB string vrátane koncovej medzery

  const { data: canon } = await sb.from('entities').select('id,ico,name').eq('ico', REAL);
  console.log('Kanon entita pre ' + REAL + ': ' + JSON.stringify(canon));

  // aj naivny strip 50513923 - existuje ako entita? (NEUROPOWER - cudzi, nemal by byt priradeny)
  const { data: strip } = await sb.from('entities').select('id,ico,name').eq('ico', '50513923');
  console.log('Entita pre strip 50513923 (NEUROPOWER, cudzi): ' + JSON.stringify(strip));

  const { data: orph } = await sb.from('entities').select('id,ico,name').eq('ico', ORPHAN);
  console.log('Orphan "' + ORPHAN + '": ' + JSON.stringify(orph));
  if (orph && orph[0]) {
    const { count: b } = await sb.from('transactions').select('*', { count: 'exact', head: true }).eq('buyer_entity_id', orph[0].id);
    const { count: s } = await sb.from('transactions').select('*', { count: 'exact', head: true }).eq('supplier_entity_id', orph[0].id);
    console.log('  orphan tx: buyer=' + (b||0) + ' supplier=' + (s||0));
  }
})();
