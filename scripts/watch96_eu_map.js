// READ-ONLY WATCH #96: namapuj kazdu z 20 eu_funds na CRZ transakciu (amount na cent) a vytiahni source_url + strany.
const fs = require('fs');
const path = require('path');
const env = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
const get = (k) => { const m = env.match(new RegExp('^' + k + '=(.+)$', 'm')); return m ? m[1].trim().replace(/^["']|["']$/g, '') : null; };
const url = get('NEXT_PUBLIC_SUPABASE_URL') || get('SUPABASE_URL');
const key = get('SUPABASE_SERVICE_ROLE_KEY') || get('SUPABASE_SERVICE_KEY') || get('NEXT_PUBLIC_SUPABASE_ANON_KEY');
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(url, key);

async function fetchAll(table, cols) {
  const PAGE = 1000; let from = 0; const all = [];
  while (true) {
    const { data, error } = await sb.from(table).select(cols).range(from, from + PAGE - 1);
    if (error) { console.log(table, 'ERR', error.message); break; }
    all.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

(async () => {
  const funds = (await sb.from('eu_funds').select('*').order('amount_eur', { ascending: false }).range(0, 999)).data;
  const tx = await fetchAll('transactions', 'id,subject,amount_eur,source_url,external_id,buyer_entity_id,supplier_entity_id');
  const ents = await fetchAll('entities', 'id,name,ico');
  const em = new Map(ents.map(e => [e.id, e]));
  console.log('eu_funds:', funds.length, '| tx:', tx.length, '| entities:', ents.length);
  const out = [];
  for (const f of funds) {
    const amt = Number(f.amount_eur);
    const matches = tx.filter(t => Math.abs(Number(t.amount_eur) - amt) < 0.005);
    const recs = matches.map(m => ({
      tx: m.id, url: m.source_url, ext: m.external_id,
      buyer: em.get(m.buyer_entity_id)?.name, buyer_ico: em.get(m.buyer_entity_id)?.ico,
      supplier: em.get(m.supplier_entity_id)?.name, supplier_ico: em.get(m.supplier_entity_id)?.ico
    }));
    out.push({ amount: amt.toFixed(2), fund_ico: f.winner_ico, project: (f.project_name || '').slice(0, 50), n: matches.length, recs });
    const urlList = recs.map(r => (r.url || 'no-url').replace('https://crz.gov.sk/zmluva/', 'crz:')).join(' ');
    console.log(`${amt.toFixed(2)} | fundICO ${f.winner_ico} | n=${matches.length} | ${urlList}`);
  }
  const noMatch = out.filter(o => o.n === 0);
  console.log('\nNO amount-match:', noMatch.length);
  for (const o of noMatch) console.log('  ', o.amount, o.fund_ico, o.project);
  fs.writeFileSync(path.join(__dirname, '..', '.audit', 'watch96_eu_map.json'), JSON.stringify(out, null, 2));
  console.log('\nwrote .audit/watch96_eu_map.json');
})();
