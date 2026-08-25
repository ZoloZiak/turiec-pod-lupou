// DV-CRZ-SUMS: dump batch of CRZ_CONTRACT rows [from, from+limit) — read-only
// usage: node audit_crz_batch.js <from> <limit> <outfile>
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const from = parseInt(process.argv[2] || '0', 10);
const limit = parseInt(process.argv[3] || '80', 10);
const out = process.argv[4];

async function main() {
  const { data, error } = await supabase
    .from('transactions')
    .select('id, external_id, amount_eur, source_url')
    .eq('source_type', 'CRZ_CONTRACT')
    .order('id', { ascending: true })
    .range(from, from + limit - 1);
  if (error) { console.error('ERR', error.message); process.exit(1); }
  fs.writeFileSync(out, JSON.stringify(data, null, 1));
  console.log(`WROTE ${data.length} rows to ${out} (range ${from}-${from + data.length - 1})`);
}
main();
