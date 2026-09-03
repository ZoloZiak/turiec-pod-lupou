#!/usr/bin/env node
// Audit DV-CRZ-SUMS batch 2000: dump 80 CRZ_CONTRACT rows (read-only), fetch CRZ detail pages,
// parse max amount, compare to DB. Writes batch + result JSON.
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');

const OUT_BATCH = path.join(__dirname, '..', '.audit', 'DV-CRZ-SUMS_batch_2000.json');
const OUT_RESULT = path.join(__dirname, '..', '.audit', 'DV-CRZ-SUMS_batch_2000_result.json');
const UA = 'Mozilla/5.0 (Macintosh) AppleWebKit/537.36 (KHTML like Gecko) Chrome/126 Safari/537.36';
const THROTTLE_MS = 1000;

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
  const { data, error } = await supabase
    .from('transactions')
    .select('id, external_id, amount_eur, source_url')
    .eq('source_type', 'CRZ_CONTRACT')
    .order('id', { ascending: true })
    .range(2000, 2079);
  if (error) { console.error('DB ERR', error.message); process.exit(1); }
  console.log(`DB rows: ${data.length}`);
  fs.writeFileSync(OUT_BATCH, JSON.stringify(data, null, 1));

  const results = [];
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    let status;
    let crzAmount = null;
    const text = await fetchWithRetry(row.source_url);
    if (text === null) {
      status = 'UNAVAILABLE';
    } else {
      const amounts = parseAmounts(normalize(text));
      if (amounts.length === 0) {
        if ((row.amount_eur || 0) === 0) { status = 'OK'; crzAmount = null; }
        else status = 'UNAVAILABLE';
      } else {
        crzAmount = Math.max(...amounts);
        const db = row.amount_eur || 0;
        if (db === 0 && crzAmount === 0) status = 'OK';
        else status = Math.abs(crzAmount - db) <= 0.01 ? 'OK' : 'MISMATCH';
      }
    }
    results.push({
      id: row.id,
      external_id: row.external_id,
      db_amount: row.amount_eur,
      crz_amount: crzAmount,
      status,
    });
    if (i % 10 === 0) console.log(`progress ${i}/${data.length}`);
    if (i < data.length - 1) await sleep(THROTTLE_MS);
  }

  fs.writeFileSync(OUT_RESULT, JSON.stringify(results, null, 2));
  const counts = {};
  for (const r of results) counts[r.status] = (counts[r.status] || 0) + 1;
  console.log('SUMMARY:', JSON.stringify(counts));
  for (const r of results.filter((r) => r.status !== 'OK')) {
    console.log(`${r.status} ${r.id} ${r.external_id} db=${r.db_amount} crz=${r.crz_amount}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
