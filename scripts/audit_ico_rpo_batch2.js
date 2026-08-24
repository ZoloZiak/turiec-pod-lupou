#!/usr/bin/env node
// Audit IČO (batch 2: items 200..239) proti RPO API ŠÚ SR.
const fs = require('fs');
const path = require('path');

const SET_FILE = path.join(__dirname, '..', '.audit', 'DV-ICO-ALL_set.json');
const OUT_FILE = path.join(__dirname, '..', '.audit', 'DV-ICO-ALL_rpo_200_239.json');
const API = 'https://api.statistics.sk/rpo/v1/search?identifier=';
const THROTTLE_MS = 350;
const RETRY_DELAYS = [3000, 3000];

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function normIco(ico) { return String(ico).trim().padStart(8, '0'); }

async function fetchRpo(ico) {
  let lastErr = null;
  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    try {
      const res = await fetch(`${API}${ico}&pageSize=5`, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(20000),
      });
      if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`);
      if (!res.ok) { // 4xx other than 429 -> definitive
        if (res.status === 404) return { hits: [] };
        throw new Error(`HTTP ${res.status}`);
      }
      return await res.json();
    } catch (e) {
      lastErr = e;
      if (attempt < RETRY_DELAYS.length) await sleep(RETRY_DELAYS[attempt]);
    }
  }
  throw lastErr;
}

async function main() {
  const all = JSON.parse(fs.readFileSync(SET_FILE, 'utf8'));
  const batch = all.items.slice(200, 240);
  const results = [];
  for (const item of batch) {
    const ico = normIco(item.ico);
    const db_name = item.name;
    let entry = { ico: item.ico, db_name, rpo_name: null, status: 'ERROR', rpo_city: null };
    try {
      const data = await fetchRpo(ico);
      const hits = Array.isArray(data.results) ? data.results : [];
      const exact = hits.find(h => {
        const vals = h && h.identifiers ? h.identifiers.map(i => normIco(i.value)) : [];
        return vals.includes(ico);
      });
      if (!exact) {
        entry.status = 'NOT_FOUND';
      } else {
        const fullNames = Array.isArray(exact.fullNames) ? exact.fullNames : [];
        const current = fullNames.find(n => !n.validTo) || fullNames[fullNames.length - 1];
        entry.rpo_name = current ? current.value : null;
        entry.status = 'OK';
        if (entry.rpo_name && db_name &&
            entry.rpo_name.replace(/\s+/g, ' ').toLowerCase() !== db_name.replace(/\s+/g, ' ').toLowerCase()) {
          entry.status = 'MISMATCH_NAME';
        }
        const addrs = Array.isArray(exact.addresses) ? exact.addresses : [];
        const addr = addrs.find(a => !a.validTo) || addrs[0] || null;
        entry.rpo_city = addr && addr.municipality ? addr.municipality.value : null;
      }
    } catch (e) {
      entry.status = 'ERROR';
      entry.error = String(e.message || e);
    }
    results.push(entry);
    console.error(`${ico} ${entry.status} ${entry.rpo_name || ''}`);
    await sleep(THROTTLE_MS);
  }
  fs.writeFileSync(OUT_FILE, JSON.stringify(results, null, 2));
  const counts = results.reduce((a, r) => ((a[r.status] = (a[r.status] || 0) + 1), a), {});
  console.log(JSON.stringify({ file: OUT_FILE, counts, problems: results.filter(r => r.status !== 'OK') }, null, 2));
}

main().catch(e => { console.error(e); process.exit(1); });
