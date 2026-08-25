// T05: read-only count tabuliek, ktoré renderujú VerifiedBadge so ŠTÁTNYM zdrojom
// (majetky->NRSR, eurofondy->ITMS, poslanci->Zaznam). Cyklus 1 ich vyprazdnil;
// overujeme ze su STALE prazdne/cestne (ziadny fabrikat pod "Overene statom").
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function countTable(name) {
  const { count, error } = await supabase.from(name).select('*', { count: 'exact', head: true });
  if (error) return `${name}: ERR ${error.message}`;
  return `${name}: ${count}`;
}

async function main() {
  for (const t of ['eu_funds', 'asset_declarations', 'city_council_votes']) {
    console.log(await countTable(t));
  }
  // ak nejake asset_declarations existuju, vypis ich (menovane osoby pod NRSR badge)
  const { data, error } = await supabase.from('asset_declarations').select('person_name, role, official_salary_eur, source_url, year').limit(50);
  if (!error && data && data.length) {
    console.log('--- asset_declarations rows (NRSR badge nad menovanou osobou) ---');
    for (const r of data) console.log(JSON.stringify(r));
  }
  const { data: eu, error: euErr } = await supabase.from('eu_funds').select('winner_name, winner_ico, amount_eur, program_name').limit(50);
  if (!euErr && eu && eu.length) {
    console.log('--- eu_funds rows (ITMS badge) ---');
    for (const r of eu) console.log(JSON.stringify(r));
  }
}
main();
