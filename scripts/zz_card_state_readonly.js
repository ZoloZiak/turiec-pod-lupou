// READ-ONLY: stav vsetkych "kariet" (tabuliek) — co je prazdne, co naplnene.
// Nic nemeni. Zolander diagnostika pred rozhodnutim co natiahnut.
require('dotenv').config({ path: '.env.local' });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const TABLES = [
  'promises', 'transactions', 'entities',
  'city_companies', 'nku_reports', 'eu_funds',
  'asset_declarations', 'city_council_votes',
];

async function run() {
  console.log('SUPABASE_URL set:', !!process.env.NEXT_PUBLIC_SUPABASE_URL);
  console.log('SERVICE_ROLE set:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);
  for (const t of TABLES) {
    const { count, error } = await supabase.from(t).select('*', { count: 'exact', head: true });
    if (error) { console.log(`${t}: CHYBA ${error.message}`); continue; }
    console.log(`${t}: COUNT=${count}`);
  }
  // sample promises ak nejake su
  const { data: pr } = await supabase.from('promises').select('*').limit(20);
  if (pr && pr.length) {
    console.log('\n--- promises sample ---');
    for (const r of pr) console.log(JSON.stringify(r));
  }
}
run().catch(e => console.log('FATAL', e.message));
