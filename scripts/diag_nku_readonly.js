// READ-ONLY: dump tabulky nku_reports (T06-nku-deep audit). Nic nemeni.
require('dotenv').config({ path: '.env.local' });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function run() {
  const { count } = await supabase
    .from('nku_reports')
    .select('*', { count: 'exact', head: true });
  console.log('COUNT nku_reports: ' + count);
  const { data, error } = await supabase
    .from('nku_reports')
    .select('*')
    .order('year', { ascending: false });
  if (error) { console.log('CHYBA: ' + error.message); return; }
  console.log('RIADKOV vratenych: ' + (data ? data.length : 0));
  console.log('---');
  for (const r of (data || [])) {
    console.log(JSON.stringify({
      id: r.id,
      year: r.year,
      title: r.title,
      status: r.status,
      penalty_eur: r.penalty_eur,
      description: r.description,
      report_url: r.report_url
    }, null, 1));
    console.log('===');
  }
}
run();
