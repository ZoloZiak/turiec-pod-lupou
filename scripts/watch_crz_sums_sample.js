#!/usr/bin/env node
// WATCH strážny režim — CRZ sumy regresná stráž (READ-ONLY, žiadna DB zmena).
// Vyber rotujúcu vzorku CRZ_CONTRACT riadkov:
//   (A) 12 najnovších podľa created_at (Krtko cez noc = najrizikovejšie na regresiu)
//   (B) 8 z rotujúceho okna podľa cursor (pokrytie celej množiny naprieč tikmi)
//   (C) všetky "podozrivé sumy" v okne: celé číslo 1..999 (príznak useknutia z crz-parsing pasce) alebo 0
// Fetchni CRZ detail, parsuj MAX sumu (zmluvná cena), porovnaj s DB na cent.
// usage: node watch_crz_sums_sample.js <cursor>
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');

const CURSOR = parseInt(process.argv[2] || '0', 10);
const OUT = path.join(__dirname, '..', '.audit', 'watch_crz_sums_result.json');
const UA = 'Mozilla/5.0 (Macintosh) AppleWebKit/537.36 (KHTML like Gecko) Chrome/126 Safari/537.36';
const THROTTLE_MS = 700;
const NEWEST_N = 12;
const WINDOW_N = 8;

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function normalize(text) {
  return text
    .replace(/\u00a0/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/[\u2000-\u200b\u202f\u205f]/g, ' ')
    .replace(/&euro;/gi, '\u20ac')
    .replace(/&#8364;/g, '\u20ac')
    .replace(/&#x20AC;/gi, '\u20ac');
}

function parseAmounts(text) {
  const re = /([0-9][0-9\s]*,[0-9]{2})\s*(\u20ac|EUR)/g;
  const out = [];
  let m;
  while ((m = re.exec(text)) !== null) {
    const num = parseFloat(m[1].replace(/\s+/g, '').replace(/,/g, '.'));
    if (!isNaN(num)) out.push(num);
  }
  return out;
}

async function fetchWithRetry(url) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
      if (res.status === 200) return await res.text();
    } catch (e) { /* fallthrough */ }
    if (attempt === 0) await sleep(2000);
  }
  return null;
}

async function main() {
  // total
  const { count, error: cErr } = await supabase
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .eq('source_type', 'CRZ_CONTRACT');
  if (cErr) { console.error('COUNT ERR', cErr.message); process.exit(1); }
  console.log('TOTAL_CRZ_CONTRACT=' + count);

  // (A) najnovšie podľa created_at
  const { data: newest, error: nErr } = await supabase
    .from('transactions')
    .select('id, external_id, amount_eur, source_url, created_at')
    .eq('source_type', 'CRZ_CONTRACT')
    .order('created_at', { ascending: false })
    .limit(NEWEST_N);
  if (nErr) { console.error('NEWEST ERR', nErr.message); process.exit(1); }

  // (B) rotujúce okno podľa cursor (order id asc, offset rotuje naprieč tikmi)
  const offset = (CURSOR * WINDOW_N) % Math.max(count, 1);
  const { data: windowRows, error: wErr } = await supabase
    .from('transactions')
    .select('id, external_id, amount_eur, source_url, created_at')
    .eq('source_type', 'CRZ_CONTRACT')
    .order('id', { ascending: true })
    .range(offset, offset + WINDOW_N - 1);
  if (wErr) { console.error('WINDOW ERR', wErr.message); process.exit(1); }

  // (C) podozrivé sumy naprieč celou množinou (paginované) — celé číslo 1..999 alebo 0
  //     (0 je legitímne pri rámcových zmluvách, ale zaradíme vzorku na kontrolu)
  const suspicious = [];
  const PAGE = 1000;
  for (let from = 0; from < count; from += PAGE) {
    const { data: page, error: pErr } = await supabase
      .from('transactions')
      .select('id, external_id, amount_eur, source_url, created_at')
      .eq('source_type', 'CRZ_CONTRACT')
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (pErr) { console.error('PAGE ERR', pErr.message); process.exit(1); }
    for (const r of page) {
      const a = r.amount_eur;
      if (a != null && a > 0 && a < 1000 && Number.isInteger(a)) suspicious.push(r);
    }
    if (page.length < PAGE) break;
  }
  console.log('SUSPICIOUS_TRUNC_CANDIDATES=' + suspicious.length);
  // z podozrivých vyber rotujúcu vzorku 6 podľa cursor (aby nebolo 100s fetchov)
  const suspSample = [];
  if (suspicious.length) {
    const sOff = (CURSOR * 6) % suspicious.length;
    for (let k = 0; k < Math.min(6, suspicious.length); k++) {
      suspSample.push(suspicious[(sOff + k) % suspicious.length]);
    }
  }

  // zjednoť množinu (dedup podľa id)
  const byId = new Map();
  for (const r of [...newest, ...windowRows, ...suspSample]) byId.set(r.id, r);
  const sample = [...byId.values()];
  console.log(`SAMPLE_SIZE=${sample.length} (newest=${newest.length} window=${windowRows.length}@${offset} susp=${suspSample.length})`);

  const results = [];
  for (let i = 0; i < sample.length; i++) {
    const row = sample[i];
    let status;
    let crzAmount = null;
    if (!row.source_url || !/^https?:\/\//.test(row.source_url)) {
      status = 'NO_URL';
    } else {
      const text = await fetchWithRetry(row.source_url);
      if (text === null) {
        status = 'UNAVAILABLE';
      } else {
        const amounts = parseAmounts(normalize(text));
        if (amounts.length === 0) {
          status = (row.amount_eur || 0) === 0 ? 'OK' : 'UNPARSEABLE';
        } else {
          crzAmount = Math.max(...amounts);
          const db = row.amount_eur || 0;
          if (db === 0 && crzAmount === 0) status = 'OK';
          else status = Math.abs(crzAmount - db) <= 0.01 ? 'OK' : 'MISMATCH';
        }
      }
    }
    results.push({
      id: row.id,
      external_id: row.external_id,
      db_amount: row.amount_eur,
      crz_amount: crzAmount,
      created_at: row.created_at,
      source_url: row.source_url,
      status,
    });
    if (i < sample.length - 1) await sleep(THROTTLE_MS);
  }

  fs.writeFileSync(OUT, JSON.stringify(results, null, 2));
  const counts = {};
  for (const r of results) counts[r.status] = (counts[r.status] || 0) + 1;
  console.log('SUMMARY:', JSON.stringify(counts));
  for (const r of results.filter((r) => r.status !== 'OK')) {
    console.log(`${r.status} id=${r.id} ${r.external_id} db=${r.db_amount} crz=${r.crz_amount} ${r.source_url}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
