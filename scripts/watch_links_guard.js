// READ-ONLY WATCH STRÁŽ (links): catch dead-link regressions.
// (A) newest N distinct source_urls (Krtko overnight = highest regression risk)
// (B) rotating window of M distinct URLs across the WHOLE set @offset=cursor*M
// (C) all nku_reports.report_url (small, always cheap)
// TLS bypass for BrainRocket MITM proxy.
// Usage: node scripts/watch_links_guard.js <cursor>
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
const { createClient } = require('@supabase/supabase-js');

const CURSOR = parseInt(process.argv[2] || '0', 10);
const NEWEST = 12;
const WINDOW = 8;

async function check(u) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 15000);
    const res = await fetch(u, {
      method: 'GET',
      redirect: 'follow',
      signal: ctrl.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible audit-watch 1.0)' },
    });
    clearTimeout(t);
    await res.arrayBuffer().catch(() => {});
    return res.status;
  } catch (e) {
    return 'ERR:' + (e.name === 'AbortError' ? 'timeout' : e.message).slice(0, 80);
  }
}

async function fullDistinct(supabase) {
  const urls = [];
  const seen = new Set();
  const PAGE = 1000;
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from('transactions')
      .select('source_url')
      .not('source_url', 'is', null)
      .order('source_url', { ascending: true })
      .range(offset, offset + PAGE - 1);
    if (error) { console.error('DB full', error.message); break; }
    for (const r of data) {
      const u = (r.source_url || '').trim();
      if (u && /^https?:\/\//i.test(u) && !seen.has(u)) { seen.add(u); urls.push(u); }
    }
    if (data.length < PAGE) break;
    offset += PAGE;
  }
  return urls;
}

async function main() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  // (A) newest distinct
  const { data: newRows, error: e1 } = await supabase
    .from('transactions')
    .select('id, source_url, created_at')
    .not('source_url', 'is', null)
    .order('created_at', { ascending: false })
    .limit(600);
  if (e1) { console.error('DB newest', e1.message); process.exit(1); }
  const seen = new Set();
  const picks = [];
  for (const r of newRows) {
    const u = (r.source_url || '').trim();
    if (!/^https?:\/\//i.test(u) || seen.has(u)) continue;
    seen.add(u);
    picks.push({ url: u, layer: 'newest', created_at: r.created_at });
    if (picks.length >= NEWEST) break;
  }

  // (B) rotating window across whole distinct set
  const full = await fullDistinct(supabase);
  const total = full.length;
  const start = total ? (CURSOR * WINDOW) % total : 0;
  for (let i = 0; i < WINDOW && i < total; i++) {
    const u = full[(start + i) % total];
    if (!seen.has(u)) { seen.add(u); picks.push({ url: u, layer: 'window' }); }
  }

  // (C) nku_reports
  const { data: nku, error: e3 } = await supabase.from('nku_reports').select('id, report_url').not('report_url', 'is', null);
  if (!e3 && nku) {
    for (const r of nku) {
      const u = (r.report_url || '').trim();
      if (/^https?:\/\//i.test(u) && !seen.has(u)) { seen.add(u); picks.push({ url: u, layer: 'nku' }); }
    }
  }

  const results = [];
  for (const p of picks) {
    const st = await check(p.url);
    results.push({ ...p, status: st });
    console.error(`${results.length}/${picks.length} [${p.layer}] ${st} ${p.url.slice(0, 68)}`);
    await new Promise(r => setTimeout(r, 200));
  }
  const bad = results.filter(r => r.status !== 200);
  const out = { cursor: CURSOR, total_distinct: total, window_offset: start, checked: results.length, bad_count: bad.length, bad, all: results };
  fs.writeFileSync(path.join(__dirname, '..', '.audit', 'watch_links_guard_result.json'), JSON.stringify(out, null, 1));
  console.log(JSON.stringify({ total_distinct: total, window_offset: start, checked: results.length, bad_count: bad.length, bad }, null, 1));
}
main().catch(e => { console.error(e); process.exit(1); });
