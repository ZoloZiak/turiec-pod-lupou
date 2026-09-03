// READ-ONLY WATCH: HTTP-check the NEWEST distinct source_urls that Krtko added
// (transactions.created_at desc) — catches dead links introduced overnight.
// Usage: node scripts/watch_links_newest.js <N>
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
const { createClient } = require('@supabase/supabase-js');

const N = parseInt(process.argv[2] || '20', 10);

async function check(u) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 15000);
    const res = await fetch(u, {
      method: 'GET',
      redirect: 'follow',
      signal: ctrl.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; audit-watch/1.0)' },
    });
    clearTimeout(t);
    await res.arrayBuffer().catch(() => {});
    return res.status;
  } catch (e) {
    return 'ERR:' + (e.name === 'AbortError' ? 'timeout' : e.message).slice(0, 80);
  }
}

async function main() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  // Pull newest rows with a source_url, dedupe by URL, keep first N distinct.
  const { data, error } = await supabase
    .from('transactions')
    .select('id, source_url, amount_eur, created_at')
    .not('source_url', 'is', null)
    .order('created_at', { ascending: false })
    .limit(600);
  if (error) { console.error('DB', error.message); process.exit(1); }

  const seen = new Set();
  const picks = [];
  for (const r of data) {
    const u = (r.source_url || '').trim();
    if (!/^https?:\/\//i.test(u)) continue;
    if (seen.has(u)) continue;
    seen.add(u);
    picks.push({ id: r.id, url: u, amount_eur: r.amount_eur, created_at: r.created_at });
    if (picks.length >= N) break;
  }

  const results = [];
  for (const p of picks) {
    const st = await check(p.url);
    results.push({ ...p, status: st });
    console.error(`${results.length}/${picks.length} ${st} ${p.url.slice(0, 70)}`);
    await new Promise(r => setTimeout(r, 200));
  }
  const bad = results.filter(r => r.status !== 200);
  fs.writeFileSync(path.join(__dirname, '..', '.audit', 'WATCH_links_newest_result.json'), JSON.stringify({ checked: results.length, bad_count: bad.length, bad, all: results }, null, 1));
  console.log(JSON.stringify({ newest_created_at: picks[0] && picks[0].created_at, checked: results.length, bad_count: bad.length, bad }, null, 1));
}
main().catch(e => { console.error(e); process.exit(1); });
