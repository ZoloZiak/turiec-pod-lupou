// READ-ONLY WATCH #256: stráž STRÁNKA /eurofondy. Regresný guard nad eu_funds.
// Zisti: count, SUM amount_eur (ručný prepočet), distinct winner_ico + distribúciu,
// bad/NaN amounty, riadky bez winner_ico, fabrikačné príznaky (live crawl/dummy/math.random/
// vyextrahované) v texte. Porovná s baseline #216 (COUNT=20, SUM 17 046 845,73 €,
// distrib 00316792:12 / 53560922:4 / 36672084:4). NIČ nemení.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const FAB = /live crawl|dummy|mock|sample|vzorov|ilustr|simul|placeholder|vyextrahovan|math\.random/i;

(async () => {
  // paginovaný fetch (istota nad 1000-cap)
  let all = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from('eu_funds').select('*').order('amount_eur', { ascending: false }).range(from, from + 999);
    if (error) { console.log('ERR', error.message); process.exit(1); }
    all = all.concat(data);
    if (data.length < 1000) break;
  }
  console.log('COUNT:', all.length);
  if (all.length === 0) { console.log('EMPTY eu_funds'); return; }
  console.log('columns:', Object.keys(all[0]).join(','));

  let sum = 0, bad = 0, noIco = 0, fab = 0;
  const dist = {};
  for (const r of all) {
    const a = Number(r.amount_eur);
    if (!Number.isFinite(a) || a < 0) { bad++; console.log('  BAD amount:', JSON.stringify({ id: r.id, amount: r.amount_eur })); }
    else sum += a;
    if (!r.winner_ico) noIco++;
    else dist[r.winner_ico] = (dist[r.winner_ico] || 0) + 1;
    const blob = [r.winner_name, r.project_name, r.program_name, r.source_url, r.external_id].join(' ');
    if (FAB.test(blob)) { fab++; console.log('  FAB signature:', JSON.stringify({ id: r.id, name: r.winner_name, project: r.project_name })); }
  }
  console.log('SUM amount_eur:', sum.toFixed(2));
  console.log('distinct winner_ico distribúcia:', JSON.stringify(dist));
  console.log('bad/NaN amount:', bad, '| bez winner_ico:', noIco, '| fabrikačné príznaky:', fab);
  console.log('--- riadky (id | ico | amount | project | source_url) ---');
  for (const r of all) {
    console.log(JSON.stringify({ id: r.id, ext: r.external_id, ico: r.winner_ico, amt: r.amount_eur, proj: (r.project_name || '').slice(0, 50), url: r.source_url }));
  }
})().catch(e => console.log('FATAL: ' + e.message));
