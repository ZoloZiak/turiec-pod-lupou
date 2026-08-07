// READ-ONLY diagnostika DB tabuliek na hardcoded/halucinovane seed data.
// 0 zapisov. Vypise pocty riadkov + vzorku obsahu pre audit.
require('dotenv').config({ path: '.env.local' });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { createClient } = require('@supabase/supabase-js');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(url, key);

const TABLES = ['nku_reports', 'eu_funds', 'asset_declarations', 'city_council_votes', 'promises'];

async function run() {
  for (const t of TABLES) {
    const { data, error, count } = await supabase.from(t).select('*', { count: 'exact' });
    console.log('\n===== ' + t + ' =====');
    if (error) { console.log('CHYBA: ' + error.message); continue; }
    console.log('POCET RIADKOV: ' + (count != null ? count : (data ? data.length : 0)));
    if (data) {
      for (const row of data) {
        console.log(JSON.stringify(row));
      }
    }
  }
}
run();
