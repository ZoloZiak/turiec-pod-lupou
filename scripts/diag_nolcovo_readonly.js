// READ-ONLY diag: co je v entities pre Nolcovo ICO
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
(async () => {
  const { data, error } = await supabase.from('entities').select('id,name,ico,type').in('ico', ['00216822', '00316822']);
  if (error) { console.error(error.message); process.exit(1); }
  console.log(JSON.stringify(data, null, 2));
})();
