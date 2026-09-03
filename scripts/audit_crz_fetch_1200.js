#!/usr/bin/env node
// Audit DV-CRZ-SUMS batch 1200: fetch CRZ detail pages, parse max amount, compare to DB.
const fs = require('fs');
const path = require('path');

const BATCH = path.join(__dirname, '..', '.audit', 'DV-CRZ-SUMS_batch_1200.json');
const OUT = path.join(__dirname, '..', '.audit', 'DV-CRZ-SUMS_batch_1200_result.json');
const UA = 'Mozilla/5.0 (Macintosh) AppleWebKit/537.36 (KHTML like Gecko) Chrome/126 Safari/537.36';
const THROTTLE_MS = 300;

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
      if (res.status === 200) {
        return await res.text();
      }
    } catch (e) {
      // fallthrough
    }
    if (attempt === 0) await sleep(2000);
  }
  return null;
}

async function main() {
  const rows = JSON.parse(fs.readFileSync(BATCH, 'utf8'));
  const results = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    let status;
    let crzAmount = null;
    const text = await fetchWithRetry(row.source_url);
    if (text === null) {
      status = 'DEAD_LINK';
    } else {
      const amounts = parseAmounts(normalize(text));
      if (amounts.length === 0) {
        status = 'UNPARSEABLE';
      } else {
        crzAmount = Math.max(...amounts);
        const diff = Math.abs(crzAmount - row.amount_eur);
        status = diff <= 0.01 ? 'OK' : 'MISMATCH';
      }
    }
    results.push({
      id: row.id,
      external_id: row.external_id,
      db_amount: row.amount_eur,
      crz_amount: crzAmount,
      status,
    });
    if (i % 10 === 0) console.log(`progress ${i}/${rows.length}`);
    if (i < rows.length - 1) await sleep(THROTTLE_MS);
  }

  fs.writeFileSync(OUT, JSON.stringify(results, null, 2));

  const counts = {};
  for (const r of results) counts[r.status] = (counts[r.status] || 0) + 1;
  console.log('SUMMARY:', JSON.stringify(counts));
  const bad = results.filter((r) => r.status !== 'OK');
  for (const r of bad) {
    console.log(`${r.status} ${r.external_id} db=${r.db_amount} crz=${r.crz_amount}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
