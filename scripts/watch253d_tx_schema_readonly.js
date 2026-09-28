// READ-ONLY: schéma transactions (1 riadok všetky stĺpce) + linkujúce stĺpce.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
(async () => {
  const { data, error } = await sb.from('transactions').select('*').limit(1);
  if (error) { console.log('ERR', error.message); return; }
  if (data && data[0]) console.log('COLUMNS:', Object.keys(data[0]).join(', '));
  else console.log('empty');
})().catch(e => console.log('FATAL: ' + e.message));
