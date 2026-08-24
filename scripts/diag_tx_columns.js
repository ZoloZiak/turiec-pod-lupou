// READ-ONLY: ukaz stlpce transactions
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
(async () => {
  const { data, error } = await supabase.from('transactions').select('*').limit(1);
  if (error) { console.log('ERR', error.message); return; }
  console.log(Object.keys(data[0]).join(', '));
})();
