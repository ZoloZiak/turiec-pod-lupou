// READ-ONLY: pochopit transactions + najst kandidatske zmluvy pre kazdy slub.
require('dotenv').config({ path: '.env.local' });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function run() {
  // 1. schema sample
  const { data: sample } = await supabase.from('transactions').select('*').limit(3);
  console.log('=== transactions columns ===');
  if (sample && sample[0]) console.log(Object.keys(sample[0]).join(', '));
  console.log('\n=== 3 sample rows ===');
  for (const r of (sample||[])) console.log(JSON.stringify(r));

  // 2. distinct subjects keyword scan pre slubove temy
  const topics = {
    'parkovanie/parkovacie': /parkov/i,
    'cesty/chodniky/asfalt': /cest|chodn|asfalt|komunik/i,
    'zelen/park/kosenie': /zelen|park|kosen|revital|strom/i,
    'MHD/doprava/autobus': /mhd|autobus|dopravn|dpmm/i,
    'nemocnica/zdravot': /nemocnic|zdravot|unm/i,
    'senior/socialne': /senior|socialn|domov/i,
    'akvapark/kupalisko': /akvapark|kupalisk|bazen|plavaren/i,
    'lanovka/martinske hole': /lanovk|martinsk.{0,3}hol/i,
  };
  const { data: all } = await supabase.from('transactions').select('id, subject, amount_eur, source_url, source_type, date_published, supplier_entity_id');
  console.log(`\n=== total tx: ${all ? all.length : 0} ===`);
  for (const [name, re] of Object.entries(topics)) {
    const hits = (all||[]).filter(t => t.subject && re.test(t.subject));
    console.log(`\n--- ${name}: ${hits.length} hits ---`);
    const top = hits.sort((a,b)=>(Number(b.amount_eur)||0)-(Number(a.amount_eur)||0)).slice(0,5);
    for (const h of top) console.log(`  ${h.id} | ${Number(h.amount_eur)||0} EUR | ${(h.subject||'').slice(0,80)}`);
  }
}
run().catch(e=>console.log('FATAL',e.message));
