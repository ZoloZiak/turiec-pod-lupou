// READ-ONLY: DB kontext podozrivých IČO z WATCH #220 stráže (64833186 CZ, 87110170 neznáme).
require('dotenv').config({ path: '.env.local' });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const ICOS = ['64833186', '87110170', '53995031'];

async function txForEntity(entityId) {
  const all = [];
  const PAGE = 1000;
  for (const col of ['buyer_entity_id', 'supplier_entity_id']) {
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase.from('transactions')
        .select('*').eq(col, entityId).range(from, from + PAGE - 1);
      if (error) throw new Error(error.message);
      data.forEach(d => all.push({ ...d, _role: col }));
      if (data.length < PAGE) break;
    }
  }
  return all;
}

(async () => {
  // najprv zisti schému transactions
  const { data: one } = await supabase.from('transactions').select('*').limit(1);
  if (one && one.length) console.log('TX stĺpce:', Object.keys(one[0]).join(', '));

  for (const ico of ICOS) {
    const { data: ents, error } = await supabase.from('entities').select('*').eq('ico', ico);
    if (error) throw new Error(error.message);
    console.log(`\n=== IČO ${ico}: ${ents.length} entity riadkov ===`);
    for (const e of ents) {
      console.log(`  entity id=${e.id} name="${e.name}" ico=${e.ico} type=${e.type || '?'}`);
      const tx = await txForEntity(e.id);
      const sum = tx.reduce((s, t) => s + (Number(t.amount_eur) || 0), 0);
      console.log(`    -> ${tx.length} transakcií, suma=${sum.toFixed(2)} €`);
      const byType = {};
      tx.forEach(t => { byType[t.source_type] = (byType[t.source_type] || 0) + 1; });
      console.log(`    source_type:`, JSON.stringify(byType));
      tx.slice(0, 6).forEach(t => console.log(`      • [${t._role}] id=${t.id} amt=${t.amount_eur} type=${t.source_type} ext=${t.external_id} subj="${(t.subject||'').slice(0,45)}" url=${t.source_url}`));
    }
  }
})().catch(e => console.log('FATAL: ' + e.message));
