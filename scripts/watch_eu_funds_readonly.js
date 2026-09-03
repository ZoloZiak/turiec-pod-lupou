// READ-ONLY diag: eu_funds tabulka vs seed. Kluce z .env.local.
const fs = require('fs');
const path = require('path');
const env = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
const get = (k) => { const m = env.match(new RegExp('^' + k + '=(.+)$', 'm')); return m ? m[1].trim().replace(/^["']|["']$/g, '') : null; };
const url = get('NEXT_PUBLIC_SUPABASE_URL') || get('SUPABASE_URL');
const key = get('SUPABASE_SERVICE_ROLE_KEY') || get('SUPABASE_SERVICE_KEY') || get('NEXT_PUBLIC_SUPABASE_ANON_KEY');
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(url, key);
(async () => {
  const { count, error: ce } = await sb.from('eu_funds').select('*', { count: 'exact', head: true });
  if (ce) { console.log('COUNT error:', ce.message); }
  console.log('eu_funds COUNT:', count);
  const { data, error } = await sb.from('eu_funds').select('id,project_name,amount_eur,program_name,year,winner_ico,winner_name').order('amount_eur', { ascending: false }).range(0, 999);
  if (error) { console.log('ERR', error.message); return; }
  console.log('rows fetched:', data.length);
  let sum = 0;
  const icos = new Map();
  for (const r of data) {
    sum += Number(r.amount_eur) || 0;
    icos.set(r.winner_ico, (icos.get(r.winner_ico) || 0) + 1);
  }
  console.log('SUM amount_eur:', sum.toFixed(2));
  console.log('distinct winner_ico:');
  for (const [k, v] of icos.entries()) console.log('  ', k, v);
  console.log('\nTOP5:');
  for (const r of data.slice(0, 5)) console.log('  ', r.amount_eur, '|', r.winner_ico, '|', r.project_name.slice(0, 60));
  // NULL/NaN guard check
  const badAmt = data.filter(r => r.amount_eur == null || isNaN(Number(r.amount_eur)));
  console.log('\nrows with bad amount_eur:', badAmt.length);
  const noIco = data.filter(r => !r.winner_ico);
  console.log('rows with no winner_ico:', noIco.length);
})();
