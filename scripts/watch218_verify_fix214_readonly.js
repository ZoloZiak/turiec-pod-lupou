#!/usr/bin/env node
// WATCH #218 — over že fix #214 (crz_12755213 amount 0->200) stále drží,
// t.j. že nočný Krtko scrape ho neprepísal späť na 0 (regresia regresie).
// READ-ONLY. Over DB hodnotu + nezávisle re-fetch CRZ detail.
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data, error } = await supabase
    .from('transactions')
    .select('id, external_id, amount_eur, source_url, created_at')
    .eq('external_id', 'crz_12755213');
  if (error) { console.error('DB ERR', error.message); process.exit(1); }
  console.log('ROWS=' + (data ? data.length : 0));
  for (const r of data) {
    console.log(JSON.stringify({ id: r.id, ext: r.external_id, amount_eur: r.amount_eur, url: r.source_url, created: r.created_at }));
  }
  const row = data && data[0];
  if (!row) { console.log('VERDICT=MISSING (riadok zmizol)'); return; }
  if (Math.abs((row.amount_eur || 0) - 200) <= 0.01) console.log('VERDICT=FIX_HOLDS (amount_eur=200)');
  else console.log('VERDICT=REGRESSED amount_eur=' + row.amount_eur);
}
main().catch((e) => { console.error(e); process.exit(1); });
