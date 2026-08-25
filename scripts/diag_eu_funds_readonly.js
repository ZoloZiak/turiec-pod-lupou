// READ-ONLY: dump tabulky eu_funds (T07-eurofondy audit). Nic nemeni.
require('dotenv').config({ path: '.env.local' });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function run() {
  const { count, error: cErr } = await supabase
    .from('eu_funds')
    .select('*', { count: 'exact', head: true });
  if (cErr) { console.log('CHYBA count: ' + cErr.message); return; }
  console.log('COUNT eu_funds: ' + count);
  const { data, error } = await supabase
    .from('eu_funds')
    .select('*')
    .order('year', { ascending: false });
  if (error) { console.log('CHYBA select: ' + error.message); return; }
  console.log('RIADKOV vratenych: ' + (data ? data.length : 0));
  console.log('---');
  for (const r of (data || [])) {
    console.log(JSON.stringify({
      id: r.id,
      year: r.year,
      program_name: r.program_name,
      project_name: r.project_name,
      amount_eur: r.amount_eur,
      winner_ico: r.winner_ico,
      winner_name: r.winner_name
    }, null, 1));
    console.log('===');
  }
}
run();
