// READ-ONLY WATCH #59 IČO stráž: over NAJNOVŠIE distinct 8-místne IČO (order created_at desc)
// zo živej DB proti RPO ŠÚ SR (exact identifier match). Cielené na Krtkove nočné prírastky =
// najväčšie riziko čerstvej zámeny subjektu (vzor #45/#53/#54).
// Usage: node scripts/watch_ico_newest.js <N>
require('dotenv').config({ path: '.env.local' });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const N = parseInt(process.argv[2] || '22', 10);
const sleep = ms => new Promise(r => setTimeout(r, ms));

function norm(s) {
  return (s || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[.,\s\-"']/g, '')
    .replace(/spolsro|sro|as|ao/g, '');
}

async function fetchNewestEntities(limit) {
  // najnovšie entity (order created_at desc), paginácia range aby sme prekonali 1000-cap
  const all = [];
  const PAGE = 1000;
  for (let from = 0; from < 3000; from += PAGE) {
    const { data, error } = await supabase
      .from('entities')
      .select('id, name, ico, created_at')
      .order('created_at', { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    all.push(...data);
    if (data.length < PAGE) break;
  }
  return all;
}

(async () => {
  const ents = await fetchNewestEntities();
  // distinct 8-místne IČO v poradí od najnovšieho created_at, prvý výskyt IČO
  const seen = new Set();
  const items = [];
  for (const e of ents) {
    if (e.ico && /^\d{8}$/.test(e.ico) && !seen.has(e.ico)) {
      seen.add(e.ico);
      items.push({ ico: e.ico, name: e.name, created_at: e.created_at });
    }
  }
  console.log(`Živý set: ${ents.length} entít -> ${items.length} distinct 8-místnych IČO. Najnovší created_at: ${items[0] && items[0].created_at}`);

  const sample = items.slice(0, N);
  const results = [];
  for (const it of sample) {
    const ico = it.ico;
    const entry = { ico, db_name: it.name, created_at: it.created_at, status: '?', reg_names: [], match: null };
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
    console.log(`${entry.status}\t${ico}\t${it.name}\t(${it.created_at})\t| reg: ${entry.reg_names.join(' | ')}`);
    await sleep(500);
  }
  const bad = results.filter(r => r.status === 'NO_EXACT_MATCH' || r.status === 'NAME_DIFF');
  const err = results.filter(r => r.status.startsWith('ERR'));
  console.log(`\n=== SUMÁR (najnovších ${sample.length} distinct IČO): OK=${results.filter(r => r.status === 'OK').length}, PODOZRIVÉ=${bad.length}, ERR=${err.length} ===`);
  if (bad.length) console.log('PODOZRIVÉ:', JSON.stringify(bad, null, 1));
  fs.writeFileSync('/Users/ziak.z/projects/turiec-pod-lupou/.audit/WATCH_icoNewest_result.json', JSON.stringify(results, null, 1));
})().catch(e => console.log('FATAL: ' + e.message));
