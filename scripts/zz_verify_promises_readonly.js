// READ-ONLY overenie: precitaj promises spat z DB a ukaz related_transaction_ids counts.
require('dotenv').config({ path: '.env.local' });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);
async function run() {
  const { data } = await supabase.from('promises').select('title,status,related_transaction_ids').order('title');
  let linked = 0, total = 0;
  for (const p of data) {
    const n = (p.related_transaction_ids||[]).length;
    total += n;
    if (n) linked++;
    console.log(`${n.toString().padStart(2)} zmluv | ${p.status} | ${p.title}`);
  }
  console.log(`\n${linked}/${data.length} slubov prepojenych, spolu ${total} vazieb na tx`);
}
run().catch(e=>console.log('FATAL',e.message));
