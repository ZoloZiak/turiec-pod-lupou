// READ-ONLY: dump vsetkych eu_funds riadkov s source_url+external_id pre CRZ re-overenie. Kluce z .env.local.
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
  console.log('rows:', data.length);
  console.log('columns:', Object.keys(data[0]).join(','));
  for (const r of data) {
    console.log(JSON.stringify({ id: r.id, external_id: r.external_id, source_url: r.source_url, amount: r.amount_eur, ico: r.winner_ico, name: r.winner_name, project: (r.project_name||'').slice(0,55), program: r.program_name, year: r.year }));
  }
})();
