// READ-ONLY WATCH #81 (LINKS, cursor=79 mod 4 = 3): HTTP-check the source_urls of the
// THREE NEW feat tables (city_council_votes, promises) that no prior WATCH has checked,
// plus a rotating window of transactions.source_url. These new links sit over NAMED
// persons under a VerifiedBadge -> a dead "official record" link = named-person regression.
// Nic nemeni. Usage: node scripts/watch_links_newtables_81.js
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; // BrainRocket MITM proxy (ako diag_*.js)
const { createClient } = require('@supabase/supabase-js');

async function check(u) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 15000);
    const res = await fetch(u, {
      method: 'GET',
      redirect: 'follow',
      signal: ctrl.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible audit-watch/1.0)' },
    });
    clearTimeout(t);
    const buf = await res.arrayBuffer().catch(() => new ArrayBuffer(0));
    return { status: res.status, finalUrl: res.url, bytes: buf.byteLength };
  } catch (e) {
    return { status: 'ERR:' + (e.name === 'AbortError' ? 'timeout' : e.message).slice(0, 80) };
  }
}

async function distinctUrls(supabase, table, col, order) {
  const PAGE = 1000; let offset = 0; const seen = new Map();
  while (true) {
    const { data, error } = await supabase.from(table).select(`${col}, ${order}`).not(col, 'is', null).order(order, { ascending: false }).range(offset, offset + PAGE - 1);
    if (error) { console.error(table, error.message); break; }
    for (const r of data) {
      const u = (r[col] || '').trim();
      if (/^https?:\/\//i.test(u) && !seen.has(u)) seen.set(u, { url: u, src: `${table}.${col}` });
    }
    if (data.length < PAGE) break;
    offset += PAGE;
  }
  return [...seen.values()];
}

async function main() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  const picks = [];
  // 1. NEW tables (highest priority, never checked)
  const votes = await distinctUrls(supabase, 'city_council_votes', 'source_url', 'vote_date');
  const proms = await distinctUrls(supabase, 'promises', 'source_url', 'created_at');
  picks.push(...votes, ...proms);

  // 2. rotating window of transactions (offset 79*7 to move each watch tick)
  const winOff = (79 * 7) % 2000;
  const { data: tx } = await supabase.from('transactions').select('source_url, created_at').not('source_url', 'is', null).order('created_at', { ascending: false }).range(winOff, winOff + 19);
  const seenTx = new Set(picks.map(p => p.url));
  for (const r of (tx || [])) {
    const u = (r.source_url || '').trim();
    if (/^https?:\/\//i.test(u) && !seenTx.has(u)) { seenTx.add(u); picks.push({ url: u, src: 'transactions.source_url(rot)' }); }
  }

  console.error(`votes distinct=${votes.length} promises distinct=${proms.length} tx window=${picks.length - votes.length - proms.length} total=${picks.length}`);

  const results = [];
  for (const p of picks) {
    const c = await check(p.url);
    results.push({ ...p, ...c });
    console.error(`${results.length}/${picks.length} ${c.status} ${(c.bytes ?? '')} ${p.url.slice(0, 80)}`);
    await new Promise(r => setTimeout(r, 300));
  }
  const bad = results.filter(r => r.status !== 200);
  const out = { checked: results.length, votes_distinct: votes.length, promises_distinct: proms.length, bad_count: bad.length, bad, all: results };
  fs.writeFileSync(path.join(__dirname, '..', '.audit', 'WATCH81_links_newtables.json'), JSON.stringify(out, null, 1));
  console.log(JSON.stringify({ checked: results.length, votes_distinct: votes.length, promises_distinct: proms.length, bad_count: bad.length, bad }, null, 1));
}
main().catch(e => { console.error(e); process.exit(1); });
