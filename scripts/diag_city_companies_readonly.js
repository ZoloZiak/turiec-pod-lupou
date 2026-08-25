// READ-ONLY: dump tabulky city_companies (T03-podniky-deep audit). Nic nemeni.
require('dotenv').config({ path: '.env.local' });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function run() {
  const { data, error } = await supabase
    .from('city_companies')
    .select('*')
    .order('name');
  if (error) { console.log('CHYBA: ' + error.message); return; }
  console.log('POCET RIADKOV city_companies: ' + (data ? data.length : 0));
  console.log('---');
  for (const r of (data || [])) {
    console.log(JSON.stringify({
      id: r.id,
      name: r.name,
      ico: r.ico,
      type: r.type,
      year: r.year,
      profit_loss_eur: r.profit_loss_eur,
      city_subsidy_eur: r.city_subsidy_eur,
      finstat_url: r.finstat_url
    }));
  }
}
run();
