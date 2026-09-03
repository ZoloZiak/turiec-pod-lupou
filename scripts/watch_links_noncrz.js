// READ-ONLY WATCH: host histogram of ALL live source_urls (transactions + nku_reports)
// + code-embedded http links, then HTTP-check EVERY non-crz.gov.sk external link
// (the real dead-link risk; CRZ almost always 200). Catches overnight Krtko-introduced
// dead links on martin.sk / turiec.com / mestske faktury / nku etc.
// Usage: node scripts/watch_links_noncrz.js
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
const { createClient } = require('@supabase/supabase-js');

function hostOf(u) { try { return new URL(u).host.toLowerCase(); } catch { return '?'; } }

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
    return { status: res.status, finalUrl: res.url };
  } catch (e) {
    return { status: 'ERR:' + (e.name === 'AbortError' ? 'timeout' : e.message).slice(0, 80) };
  }
}

async function collectCol(supabase, table, col) {
  const PAGE = 1000; let offset = 0; const out = [];
  while (true) {
    const { data, error } = await supabase.from(table).select(`id, ${col}, created_at`).not(col, 'is', null).order('created_at', { ascending: false }).range(offset, offset + PAGE - 1);
    if (error) { console.error(table, error.message); break; }
    for (const r of data) {
      const u = (r[col] || '').trim();
      if (/^https?:\/\//i.test(u)) out.push({ id: r.id, url: u, created_at: r.created_at, src: `${table}.${col}` });
    }
    if (data.length < PAGE) break;
    offset += PAGE;
  }
  return out;
}

function walkCode(dir, acc) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walkCode(p, acc);
    else if (/\.(tsx?|ts|js|mjs)$/.test(e.name)) {
      const txt = fs.readFileSync(p, 'utf8');
      const re = /https?:\/\/[^\s"'`)\]>]+/g; let m;
      while ((m = re.exec(txt))) {
        const u = m[0].replace(/[.,;]+$/, '');
        acc.push({ id: null, url: u, created_at: null, src: 'code:' + path.relative(path.join(__dirname, '..'), p) });
      }
    }
  }
}

async function main() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  let rows = [];
  rows = rows.concat(await collectCol(supabase, 'transactions', 'source_url'));
  rows = rows.concat(await collectCol(supabase, 'nku_reports', 'report_url'));
  walkCode(path.join(__dirname, '..', 'src'), rows);

  // dedupe by URL, keep first occurrence (newest first for DB rows)
  const seen = new Map();
  for (const r of rows) if (!seen.has(r.url)) seen.set(r.url, r);
  const all = [...seen.values()];

  const byHost = {};
  for (const r of all) { const h = hostOf(r.url); byHost[h] = (byHost[h] || 0) + 1; }

  // non-CRZ external links = the risky set (dedupe by host+path already via URL)
  const nonCrz = all.filter(r => hostOf(r.url) !== 'crz.gov.sk');

  const results = [];
  for (const r of nonCrz) {
    const c = await check(r.url);
    results.push({ ...r, ...c });
    console.error(`${results.length}/${nonCrz.length} ${c.status} ${r.url.slice(0, 75)}`);
    await new Promise(res => setTimeout(res, 200));
  }
  const bad = results.filter(r => r.status !== 200);
  const out = { checked: results.length, distinct_urls_total: all.length, byHost, bad_count: bad.length, bad, all: results };
  fs.writeFileSync(path.join(__dirname, '..', '.audit', 'WATCH_links_noncrz_result.json'), JSON.stringify(out, null, 1));
  console.log(JSON.stringify({ distinct_urls_total: all.length, byHost, nonCrz_checked: results.length, bad_count: bad.length, bad }, null, 1));
}
main().catch(e => { console.error(e); process.exit(1); });
