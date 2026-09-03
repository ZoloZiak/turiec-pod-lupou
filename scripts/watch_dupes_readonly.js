// WATCH stráž STRÁNKA / : READ-ONLY detekcia regresie hero income cez duplikáty.
// 1) detail dvoch 6,63M INCOME zmluv (rovnaká suma = podozrenie na scraper-duplikát)
// 2) duplikáty external_id v CELEJ DB (Krtko vloží ten istý CRZ doklad 2x -> nafúkne hero)
// 3) duplikáty (source_url + amount_eur) ako druhý signál. Nič nemení.
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const PAGE = 1000;
const IDS = ['cfa74337-e12d-4c79-9a3b-dbafff900eca', '0d0588c4-9258-45d5-81d9-b1ac31a1d146'];

async function fetchAll() {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('transactions')
      .select('id, external_id, source_type, amount_eur, subject, source_url, buyer:buyer_entity_id(name, ico), supplier:supplier_entity_id(name, ico)')
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < PAGE) break;
  }
  return rows;
}

async function main() {
  const rows = await fetchAll();
  console.log('total rows =', rows.length);

  console.log('\n=== 1) DETAIL dvoch 6,63M INCOME zmluv ===');
  for (const id of IDS) {
    const t = rows.find(r => r.id === id);
    if (!t) { console.log(id, 'NENAJDENA'); continue; }
    console.log(JSON.stringify({ id: t.id, ext: t.external_id, type: t.source_type, amt: t.amount_eur,
      subj: (t.subject||'').slice(0,80), url: t.source_url, buyer: t.buyer, supplier: t.supplier }));
  }

  console.log('\n=== 2) DUPLIKATY external_id (count>1) ===');
  const byExt = {};
  for (const r of rows) { const k = r.external_id || '(null)'; (byExt[k] = byExt[k] || []).push(r); }
  const dupExt = Object.entries(byExt).filter(([, a]) => a.length > 1);
  console.log('distinct external_id =', Object.keys(byExt).length, '| duplikatnych external_id =', dupExt.length);
  for (const [k, a] of dupExt.slice(0, 30)) {
    const amts = a.map(x => Number(x.amount_eur) || 0);
    console.log(`  ${k} x${a.length}  amts=[${amts.join(', ')}]  ids=[${a.map(x=>x.id.slice(0,8)).join(',')}]`);
  }

  console.log('\n=== 3) DUPLIKATY (source_url + amount_eur) count>1 ===');
  const byUrlAmt = {};
  for (const r of rows) {
    if (!r.source_url) continue;
    const k = r.source_url + '||' + (Number(r.amount_eur) || 0);
    (byUrlAmt[k] = byUrlAmt[k] || []).push(r);
  }
  const dupUA = Object.entries(byUrlAmt).filter(([, a]) => a.length > 1);
  console.log('duplikatnych (url+amount) =', dupUA.length);
  let sumDupExtra = 0;
  for (const [k, a] of dupUA.slice(0, 40)) {
    const amt = Number(a[0].amount_eur) || 0;
    sumDupExtra += amt * (a.length - 1);
    console.log(`  x${a.length}  amt=${amt}  ext=[${a.map(x=>x.external_id).join(',')}]  ${k.split('||')[0].slice(0,60)}`);
  }
  console.log('=> extra suma z (url+amount) duplikatov (nad prvym vyskytom):', sumDupExtra.toFixed(2), 'EUR');
  console.log('\n=== koniec ===');
}
main().catch(e => { console.error('FATAL', e.message); process.exit(1); });
