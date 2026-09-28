// READ-ONLY: najnovšie entity podľa created_at desc (skutočný nočný prírastok Krtko).
require('dotenv').config({ path: '.env.local' });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const N = parseInt(process.argv[2] || '15', 10);
(async () => {
  const { data, error } = await supabase
    .from('entities')
    .select('id, name, ico, created_at')
    .order('created_at', { ascending: false })
    .limit(N);
  if (error) { console.log('ERR: ' + error.message); return; }
  for (const e of data) {
    const shape = !e.ico ? 'NO_ICO' : (/^\d{8}$/.test(e.ico) ? '8d' : 'MALFORMED');
    console.log(`${e.created_at}\t${shape}\t${e.ico || '-'}\t${e.name}`);
  }
})().catch(e => console.log('FATAL: ' + e.message));
