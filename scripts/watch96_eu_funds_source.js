// READ-ONLY diag WATCH #96: eu_funds vsetky stlpce + hlada CRZ/source referenciu pre overenie proti realite.
const fs = require('fs');
const path = require('path');
const env = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
const get = (k) => { const m = env.match(new RegExp('^' + k + '=(.+)$', 'm')); return m ? m[1].trim().replace(/^["']|["']$/g, '') : null; };
const url = get('NEXT_PUBLIC_SUPABASE_URL') || get('SUPABASE_URL');
const key = get('SUPABASE_SERVICE_ROLE_KEY') || get('SUPABASE_SERVICE_KEY') || get('NEXT_PUBLIC_SUPABASE_ANON_KEY');
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(url, key);
(async () => {
  const { data, error } = await sb.from('eu_funds').select('*').order('amount_eur', { ascending: false }).range(0, 999);
  if (error) { console.log('ERR', error.message); return; }
  console.log('COLUMNS:', Object.keys(data[0]).join(', '));
  console.log('\nALL 20 rows (amount | ico | program | year | project):');
  for (const r of data) {
    console.log(`  ${Number(r.amount_eur).toFixed(2)} | ${r.winner_ico} | ${r.program_name || '-'} | ${r.year} | ${(r.project_name||'').slice(0,55)}`);
  }
  // ak existuje nejaka source/crz kolonka
  const sample = data[0];
  const srcKeys = Object.keys(sample).filter(k => /source|crz|url|ref|contract|tx/i.test(k));
  console.log('\nsource-like columns:', srcKeys.join(', ') || 'NONE');
  if (srcKeys.length) {
    console.log('source values (top5):');
    for (const r of data.slice(0,5)) console.log('  ', srcKeys.map(k=>`${k}=${r[k]}`).join(' | '));
  }
})();
