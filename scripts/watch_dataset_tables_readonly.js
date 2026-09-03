// READ-ONLY: overenie 5 dataset tabuliek za ded0389 (dataset API refactor).
// Potvrdi realitu (podniky/nku/eu_funds/asset_declarations/city_council_votes)
// a lovi fabrikacne signatury (Math.random-like sumy, dummy/sample/mock, fejk mena).
// Nic nemeni.
require('dotenv').config({ path: '.env.local' });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const TABLES = ['city_companies', 'nku_reports', 'eu_funds', 'asset_declarations', 'city_council_votes'];
const FAB = /dummy|mock|sample|vzorov|ilustr|simul|live crawl|placeholder|example|lorem|test\s*data|Ján Kováč|Peter Novák/i;

async function run() {
  for (const t of TABLES) {
    const { count, error: cerr } = await supabase.from(t).select('*', { count: 'exact', head: true });
    if (cerr) { console.log(`${t}: CHYBA ${cerr.message}`); continue; }
    console.log(`\n=== ${t}: COUNT=${count} ===`);
    if (!count) continue;
    const { data, error } = await supabase.from(t).select('*');
    if (error) { console.log(`  dump CHYBA ${error.message}`); continue; }
    for (const r of (data || [])) {
      const blob = JSON.stringify(r);
      const flag = FAB.test(blob) ? '  <<< FABRIKACNA SIGNATURA' : '';
      console.log('  ' + blob + flag);
    }
  }
}
run();
