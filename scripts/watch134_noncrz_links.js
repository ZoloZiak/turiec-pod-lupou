// READ-ONLY WATCH #134 doplnok — non-CRZ scraper linky z NE-transactions tabuliek.
// promises.source_url + nku_reports.report_url + eu_funds.source_url — presne tie domény
// (martin.sk / turiec.com / nku.gov.sk) čo v minulosti zdochli (WATCH #120, T10, DV-LINKS).
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
const { createClient } = require('@supabase/supabase-js');

async function check(u) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 15000);
    const res = await fetch(u, { method: 'GET', redirect: 'follow', signal: ctrl.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; audit-watch/1.0)' } });
    clearTimeout(t);
    await res.arrayBuffer().catch(() => {});
    return res.status;
  } catch (e) { return 'ERR:' + (e.name === 'AbortError' ? 'timeout' : e.message).slice(0, 80); }
}

async function grab(supabase, table, col) {
  const { data, error } = await supabase.from(table).select(`id, ${col}`).not(col, 'is', null).range(0, 999);
  if (error) return { table, err: error.message, rows: [] };
  return { table, rows: (data || []).map(r => ({ id: r.id, url: (r[col] || '').trim(), col })) };
}

async function main() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const sources = [
    ['promises', 'source_url'],
    ['nku_reports', 'report_url'],
    ['eu_funds', 'source_url'],
  ];
  const seen = new Set();
  const picks = [];
  const tableInfo = [];
  for (const [t, c] of sources) {
    const g = await grab(supabase, t, c);
    tableInfo.push({ table: t, err: g.err || null, count: g.rows.length });
    for (const r of g.rows) {
      if (!/^https?:\/\//i.test(r.url)) continue;
      if (seen.has(r.url)) continue;
      seen.add(r.url);
      picks.push({ table: t, id: r.id, url: r.url });
    }
  }
  const results = [];
  for (const p of picks) {
    const st = await check(p.url);
    results.push({ ...p, status: st });
    console.error(`${results.length}/${picks.length} [${p.table}] ${st} ${p.url.slice(0, 70)}`);
    await new Promise(r => setTimeout(r, 200));
  }
  const bad = results.filter(r => r.status !== 200);
  const out = { tables: tableInfo, distinct_urls: picks.length, bad_count: bad.length, bad };
  fs.writeFileSync(path.join(__dirname, '..', '.audit', 'WATCH134_nonCrz_links.json'), JSON.stringify({ ...out, all: results }, null, 1));
  console.log(JSON.stringify(out, null, 1));
}
main().catch(e => { console.error(e); process.exit(1); });
