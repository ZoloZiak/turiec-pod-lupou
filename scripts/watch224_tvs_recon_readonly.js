// WATCH #224 READ-ONLY — reconcile TVS (36672084) supplier agregát: raw DB (paginované) vs produkcia.
// Over že /dodavatel/[ico] súčet sedí a dedup/1000-cap TVS neskresľuje. Nemení nič.
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const sb = createClient(url, key);

async function main() {
  const TVS_ICO = '36672084';
  // nájdi entity id pre TVS
  const { data: ents } = await sb.from('entities').select('id,ico,name').eq('ico', TVS_ICO);
  console.log('TVS entities:', JSON.stringify(ents));
  if (!ents || !ents.length) { console.log('NO ENTITY'); return; }
  const eid = ents[0].id;

  // paginovane vytiahni všetky tx kde supplier_entity_id = eid
  let all = [];
  let from = 0;
  const page = 1000;
  while (true) {
    const { data, error } = await sb
      .from('transactions')
      .select('id,external_id,amount_eur,supplier_entity_id')
      .eq('supplier_entity_id', eid)
      .range(from, from + page - 1);
    if (error) { console.log('ERR', error.message); return; }
    all = all.concat(data);
    if (data.length < page) break;
    from += page;
  }
  const rawCount = all.length;
  const rawSum = all.reduce((s, t) => s + (Number(t.amount_eur) || 0), 0);
  console.log('RAW DB (supplier): count=' + rawCount + ' sum=' + rawSum.toFixed(2));
  console.log('PRODUKCIA (Vercel): count=30 sum=6451.00');
  console.log('MATCH count=' + (rawCount === 30) + ' MATCH sum=' + (Math.abs(rawSum - 6451.00) < 0.005));
}
main();
