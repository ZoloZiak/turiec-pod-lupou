require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
(async () => {
  const { data, error } = await supabase.from('entities').select('id, ico, name').in('ico', ['44802030', '45516286', '45689792', '46042865', '47493540', '46482377', '47526611', '47552549']);
  console.log(JSON.stringify({ error, data }, null, 1));
})();
