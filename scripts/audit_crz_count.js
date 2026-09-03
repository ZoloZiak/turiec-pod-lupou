// DV-CRZ-SUMS: count total CRZ_CONTRACT transactions (exact, read-only)
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { count, error } = await supabase
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .eq('source_type', 'CRZ_CONTRACT');
  if (error) { console.error('ERR', error.message); process.exit(1); }
  console.log('TOTAL_CRZ_CONTRACT=' + count);
}
main();
