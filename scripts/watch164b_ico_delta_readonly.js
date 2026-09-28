// READ-ONLY: WATCH #164 IČO delta stráž. Porovná živý set (.audit/watch_ico_live_set.json,
// vygenerovaný dnes) proti baseline DV-ICO-ALL_set.json (2026-08-24, 315 IČO) a overí KAŽDÉ
// nové IČO pridané cez noc (Krtko) proti RPO ŠÚ SR (presná zhoda identifiers[].value).
// Chytí nočnú regresiu: malformované / fabrikované / neexistujúce IČO od scrapera.
// Žiadny zápis do DB. node scripts/watch164b_ico_delta_readonly.js
const fs = require('fs');
const live = JSON.parse(fs.readFileSync('.audit/watch_ico_live_set.json', 'utf8'));
const base = JSON.parse(fs.readFileSync('.audit/DV-ICO-ALL_set.json', 'utf8'));
const baseIco = new Set(base.items.map(x => x.ico));
const delta = live.items.filter(x => !baseIco.has(x.ico));
const sleep = ms => new Promise(r => setTimeout(r, ms));

function norm(s) {
  return (s || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[.,\s\-"']/g, '')
    .replace(/spolsro|sro|as|ao/g, '');
}

(async () => {
  console.log(`Baseline: ${base.items.length} IČO. Živé: ${live.items.length} IČO. NOVÝCH (delta): ${delta.length}`);
  const results = [];
  for (const it of delta) {
    const ico = it.ico;
    let entry = { ico, db_name: it.name, status: '?', reg_names: [], match: null };
    if (!/^\d{8}$/.test(ico)) {
      entry.status = 'MALFORMED_ICO';
      results.push(entry);
      console.log(`${entry.status}\t${ico}\t${it.name}`);
      continue;
    }
    try {
      const res = await fetch(`https://api.statistics.sk/rpo/v1/search?identifier=${ico}`, {
        headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(25000),
      });
      const d = await res.json();
      const exact = (d.results || []).filter(x => (x.identifiers || []).some(i => i.value === ico));
      if (exact.length === 0) {
        entry.status = 'NO_EXACT_MATCH';
      } else {
        const names = [];
        exact.forEach(x => (x.fullNames || []).forEach(n => names.push(n.value)));
        entry.reg_names = names;
        const nd = norm(it.name);
        entry.match = names.some(n => { const nn = norm(n); return nn.includes(nd) || nd.includes(nn); });
        entry.status = entry.match ? 'OK' : 'NAME_DIFF';
      }
    } catch (e) {
      entry.status = 'ERR:' + e.message;
    }
    results.push(entry);
    console.log(`${entry.status}\t${ico}\t${it.name}\t| reg: ${entry.reg_names.join(' | ')}`);
    await sleep(500);
  }
  const bad = results.filter(r => r.status === 'NO_EXACT_MATCH' || r.status === 'NAME_DIFF' || r.status === 'MALFORMED_ICO');
  const err = results.filter(r => r.status.startsWith('ERR'));
  console.log(`\n=== DELTA SUMÁR: ${results.length} nových IČO, OK=${results.filter(r => r.status === 'OK').length}, PODOZRIVÉ=${bad.length}, ERR=${err.length} ===`);
  if (bad.length) console.log('PODOZRIVÉ:', JSON.stringify(bad, null, 1));
  fs.writeFileSync('.audit/WATCH164b_ico_delta_result.json', JSON.stringify(results, null, 1));
})().catch(e => console.log('FATAL: ' + e.message));
