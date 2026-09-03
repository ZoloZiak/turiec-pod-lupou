// READ-ONLY WATCH #91 (LINKS, cursor=90 mod 4 = 2): HTTP-check the NEW links introduced by
// the 2026-08-29 feat commits that no prior LINKS watch covered:
//   - city_council_votes.source_url  (d2611e9, 1612 votes over NAMED persons -> dead "official
//     record" link = named-person regression on transparency site)
//   - promises.related_transaction_ids -> transactions.source_url (0008d15, 8/11 sluby -> CRZ)
//   - eu_funds winner_ico register targets are UI-generated (no source_url) -> skip here.
// Nic nemeni. Usage: node scripts/watch_links_feat_91.js
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; // BrainRocket MITM proxy (ako diag_*.js)
const { createClient } = require('@supabase/supabase-js');

async function check(u) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 20000);
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

async function pageAll(supabase, table, cols, order) {
  const PAGE = 1000; let offset = 0; const rows = [];
  while (true) {
    const { data, error } = await supabase.from(table).select(cols).order(order, { ascending: false }).range(offset, offset + PAGE - 1);
    if (error) { console.error(table, error.message); break; }
    rows.push(...data);
    if (data.length < PAGE) break;
    offset += PAGE;
  }
  return rows;
}

async function main() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  const picks = []; const seen = new Set();
  const addUrl = (u, src, extra) => {
    const url = (u || '').trim();
    if (!/^https?:\/\//i.test(url) || seen.has(url)) return;
    seen.add(url); picks.push({ url, src, ...(extra || {}) });
  };

  // 1. council_votes.source_url — distinct links + how many votes each backs
  const votes = await pageAll(supabase, 'city_council_votes', 'source_url, vote_date', 'vote_date');
  const voteCount = {};
  for (const v of votes) { const u = (v.source_url || '').trim(); if (u) voteCount[u] = (voteCount[u] || 0) + 1; }
  for (const u of Object.keys(voteCount)) addUrl(u, 'city_council_votes.source_url', { backs_votes: voteCount[u] });

  // 2. promises.related_transaction_ids -> transactions.source_url (slubomer CRZ prepojenia)
  const proms = await pageAll(supabase, 'promises', 'title, status, related_transaction_ids, source_url', 'created_at');
  const relIds = [];
  for (const p of proms) { addUrl(p.source_url, 'promises.source_url'); for (const id of (p.related_transaction_ids || [])) relIds.push(id); }
  const relTxUrls = {};
  for (let i = 0; i < relIds.length; i += 100) {
    const chunk = relIds.slice(i, i + 100);
    const { data: txs, error } = await supabase.from('transactions').select('id, external_id, source_url').in('id', chunk);
    if (error) { console.error('tx', error.message); continue; }
    for (const t of (txs || [])) relTxUrls[t.id] = t;
  }
  for (const id of relIds) { const t = relTxUrls[id]; if (t && t.source_url) addUrl(t.source_url, 'slubomer->tx.source_url', { external_id: t.external_id }); }

  console.error(`votes distinct=${Object.keys(voteCount).length} (${votes.length} rows) promises rows=${proms.length} relTxIds=${relIds.length} total distinct links=${picks.length}`);

  const results = [];
  for (const p of picks) {
    const c = await check(p.url);
    results.push({ ...p, ...c });
    console.error(`${results.length}/${picks.length} ${c.status} ${(c.bytes ?? '')} [${p.src}] ${p.url.slice(0, 75)}`);
    await new Promise(r => setTimeout(r, 300));
  }
  const bad = results.filter(r => r.status !== 200);
  const out = { checked: results.length, votes_distinct: Object.keys(voteCount).length, votes_rows: votes.length, promises_rows: proms.length, rel_tx_ids: relIds.length, bad_count: bad.length, bad, all: results };
  fs.writeFileSync(path.join(__dirname, '..', '.audit', 'WATCH91_links_feat.json'), JSON.stringify(out, null, 1));
  console.log(JSON.stringify({ checked: results.length, votes_distinct: Object.keys(voteCount).length, bad_count: bad.length, bad }, null, 1));
}
main().catch(e => { console.error(e); process.exit(1); });
