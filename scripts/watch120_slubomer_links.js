// WATCH #120 READ-ONLY: over HTTP status vsetkych linkov na /slubomer.
// (a) distinct promises.source_url domeny, (b) vsetky related_transaction_ids CRZ linky.
// Regresny vektor v strannom rezime: mrtvy link zavedeny cez noc / vrateny fabrikat.
// READ-ONLY. NODE_EXTRA_CA_CERTS = corp-ca-bundle kvoli BrainRocket MITM.
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const UA = 'Mozilla/5.0 (Macintosh Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36';
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function head(url) {
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 12000);
    let res = await fetch(url, { method: 'GET', redirect: 'follow', signal: ac.signal, headers: { 'User-Agent': UA } });
    clearTimeout(t);
    return { url, status: res.status, finalUrl: res.url };
  } catch (e) {
    return { url, status: 'ERR:' + (e.name || e.message) };
  }
}

async function run() {
  const { data: promises } = await supabase
    .from('promises').select('title,source_url,related_transaction_ids').order('title');

  // (a) distinct promise source_url
  const promiseUrls = [...new Set((promises || []).map(p => p.source_url).filter(Boolean))];
  // (b) all related tx CRZ urls
  const allIds = [];
  for (const p of (promises || [])) for (const id of (p.related_transaction_ids || [])) allIds.push(id);
  const txUrls = [];
  for (let i = 0; i < allIds.length; i += 100) {
    const { data: txs } = await supabase.from('transactions')
      .select('id,source_url').in('id', allIds.slice(i, i + 100));
    for (const t of (txs || [])) if (t.source_url) txUrls.push(t.source_url);
  }
  const distinctTxUrls = [...new Set(txUrls)];

  console.log('=== PROMISE source_url (' + promiseUrls.length + ' distinct) ===');
  const promiseResults = [];
  for (const u of promiseUrls) { const r = await head(u); promiseResults.push(r); console.log(JSON.stringify(r)); await sleep(250); }

  console.log('\n=== CRZ tx source_url (' + distinctTxUrls.length + ' distinct) ===');
  const txResults = [];
  for (const u of distinctTxUrls) { const r = await head(u); txResults.push(r); console.log(JSON.stringify(r)); await sleep(200); }

  const bad = [...promiseResults, ...txResults].filter(r => !(r.status >= 200 && r.status < 400));
  console.log('\n=== SUMMARY ===');
  console.log('promise_checked=' + promiseResults.length + ' tx_checked=' + txResults.length + ' BAD=' + bad.length);
  if (bad.length) console.log('BAD LIST: ' + JSON.stringify(bad));
}
run().catch(e => console.log('FATAL', e.message));
