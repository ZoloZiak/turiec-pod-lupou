// READ-ONLY: zisti stĺpce entities (má created_at?) + počet distinct 8-místnych IČO.
require('dotenv').config({ path: '.env.local' });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  const { data, error } = await supabase.from('entities').select('*').limit(1);
  if (error) { console.log('ERR select*: ' + error.message); return; }
  console.log('KEYS entities: ' + JSON.stringify(Object.keys(data[0] || {})));
  console.log('SAMPLE: ' + JSON.stringify(data[0]));
})().catch(e => console.log('FATAL: ' + e.message));
