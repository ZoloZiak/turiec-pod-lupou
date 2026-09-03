// READ-ONLY: overenie ze /api/supplier po oprave zozbiera transakcie naprieic triedou
// ekvivalencie ICO (kanonicke 00316822 + orphan 00216822). Simuluje novu route logiku.
// Nic nemeni.
require('dotenv').config({ path: '.env.local' });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const CORRECT = '00316822';
const WRONG = ['00216822'];

async function collect(entityIds, label) {
  const { data, error } = await supabase.from('transactions')
    .select('id, external_id, amount_eur, subject, supplier_entity_id')
    .in('supplier_entity_id', entityIds)
    .order('date_published', { ascending: false });
  if (error) { console.log(`${label}: CHYBA ${error.message}`); return []; }
  const total = (data || []).reduce((a, t) => a + (Number(t.amount_eur) || 0), 0);
  console.log(`${label}: ${data.length} tx, sum=${total} EUR`);
  for (const t of data) console.log('   ', t.external_id, t.amount_eur, '|', t.subject);
  return data;
}

async function run() {
  // kanonicka entita
  const { data: canon } = await supabase.from('entities').select('*').eq('ico', CORRECT).single();
  console.log(`kanonicka entita: ${canon.name} id=${canon.id}`);
  // orphan entity s chybnym ICO
  const { data: orphans } = await supabase.from('entities').select('id, ico, name').in('ico', WRONG);
  console.log(`orphan entit: ${orphans.length}`, JSON.stringify(orphans.map(o => ({ ico: o.ico, id: o.id }))));

  console.log('\n-- STARE spravanie (len kanonicka entita) --');
  await collect([canon.id], 'kanonicka len');

  const all = [canon.id, ...orphans.map(o => o.id)];
  console.log('\n-- NOVE spravanie (kanonicka + orphan) --');
  await collect(all, 'trieda ekvivalencie');
}
run();
