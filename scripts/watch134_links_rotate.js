// READ-ONLY WATCH #134 — rotujúca link-stráž.
// Paginovane (.range) zozbiera VŠETKY distinct source_url z transactions,
// vyberie: (a) rotujúce okno 14 podľa cursor (offset = (cursor*14) mod total),
//          (b) 6 najnovších podľa created_at (nočný Krtko),
//          (c) všetky non-CRZ scraper domény z okna dostanú prioritu (tam regresia hrozí).
// HTTP GET status každej, mŕtve (!=200 a !=403-bot) vypíše.
// Usage: node scripts/watch134_links_rotate.js <cursor>
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
const { createClient } = require('@supabase/supabase-js');

const CURSOR = parseInt(process.argv[2] || '134', 10);
const WINDOW = 14;
const NEWEST = 6;

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

async function allRows(supabase) {
  const out = [];
  let from = 0;
  const step = 1000;
  for (;;) {
    const { data, error } = await supabase
      .from('transactions')
      .select('id, source_url, created_at')
      .not('source_url', 'is', null)
      .order('id', { ascending: true })
      .range(from, from + step - 1);
    if (error) { console.error('DB', error.message); process.exit(1); }
    if (!data || data.length === 0) break;
    out.push(...data);
    if (data.length < step) break;
    from += step;
  }
  return out;
}

async function main() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const rows = await allRows(supabase);

  // distinct URL, zachovaj najnovší created_at pre každý
  const map = new Map();
  for (const r of rows) {
    const u = (r.source_url || '').trim();
    if (!/^https?:\/\//i.test(u)) continue;
    const prev = map.get(u);
    if (!prev || (r.created_at || '') > (prev.created_at || '')) map.set(u, { url: u, created_at: r.created_at, id: r.id });
  }
  const distinct = [...map.values()];
  const total = distinct.length;

  // stabilné poradie podľa URL pre rotujúce okno
  const byUrl = [...distinct].sort((a, b) => a.url.localeCompare(b.url));
  const offset = total ? ((CURSOR * WINDOW) % total) : 0;
  const windowPick = [];
  for (let i = 0; i < WINDOW && i < total; i++) windowPick.push(byUrl[(offset + i) % total]);

  // najnovšie podľa created_at
  const byDate = [...distinct].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  const newestPick = byDate.slice(0, NEWEST);

  // non-CRZ scraper domény z celku (regresné rizikové) — pridaj do vzorky ak nie sú v CRZ
  const nonCrz = byDate.filter(d => !/crz\.gov\.sk/i.test(d.url)).slice(0, 8);

  const seen = new Set();
  const picks = [];
  for (const p of [...windowPick, ...newestPick, ...nonCrz]) {
    if (!p || seen.has(p.url)) continue;
    seen.add(p.url);
    picks.push(p);
  }

  const results = [];
  for (const p of picks) {
    const st = await check(p.url);
    results.push({ id: p.id, url: p.url, created_at: p.created_at, status: st });
    console.error(`${results.length}/${picks.length} ${st} ${p.url.slice(0, 80)}`);
    await new Promise(r => setTimeout(r, 200));
  }
  // 403 na finstat/rpvs = bot-ochrana (známe, netreba riešiť); mŕtve = ostatné non-200
  const bad = results.filter(r => r.status !== 200 && !(r.status === 403 && /finstat\.sk|rpvs\.gov\.sk/i.test(r.url)));
  const out = {
    cursor: CURSOR, total_distinct: total, window_offset: offset,
    checked: results.length, bad_count: bad.length, bad,
    domains: [...new Set(distinct.map(d => { try { return new URL(d.url).hostname; } catch { return '?'; } }))],
  };
  fs.writeFileSync(path.join(__dirname, '..', '.audit', 'WATCH134_links_result.json'), JSON.stringify({ ...out, all: results }, null, 1));
  console.log(JSON.stringify(out, null, 1));
}
main().catch(e => { console.error(e); process.exit(1); });
