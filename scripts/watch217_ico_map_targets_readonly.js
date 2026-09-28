// READ-ONLY WATCH #217 IČO stráž — HĹBKA: over že KAŽDÉ cieľové (opravené) IČO v mape
// ICO_CORRECTIONS (entity-ico-fixes.ts) mapuje na REÁLNY subjekt v RPO ŠÚ SR, ktorého názov
// zodpovedá menu entity z DB. Chytí regresiu: mapa opravuje malformované IČO na CUDZÍ/neexistujúci
// subjekt (naivný strip pasca dokumentovaná pri BTI/Generali/EUROPOWER/RRA). MULTI-string cieľ=null
// je len guardovaný (GUARD_OK), nie mapovaný — preskočí sa.
// node scripts/watch217_ico_map_targets_readonly.js
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const fs = require('fs');
const sleep = ms => new Promise(r => setTimeout(r, ms));

function norm(s) {
  return (s || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[.,\s\-"']/g, '')
    .replace(/spolsro|sro|as|ao|akciovaspolocnost/g, '');
}

// vytiahni páry chybné->správne z ICO_CORRECTIONS bloku
const src = fs.readFileSync('src/lib/entity-ico-fixes.ts', 'utf8');
const block = src.slice(src.indexOf('const ICO_CORRECTIONS'), src.indexOf('};', src.indexOf('const ICO_CORRECTIONS')));
const pairs = [];
const re = /'((?:[^'\\]|\\.)*)'\s*:\s*'(\d{8})'/g;
let m;
while ((m = re.exec(block)) !== null) pairs.push({ wrong: m[1].replace(/\\'/g, "'"), correct: m[2] });

// mapovanie cieľové IČO -> očakávaný názov (z DB mena entity spájanej cez malformed impact)
const impact = JSON.parse(fs.readFileSync('.audit/WATCH_ico_malformed_impact.json', 'utf8'));
const nameByWrong = {};
for (const r of impact) nameByWrong[r.ico] = r.name;

(async () => {
  console.log(`Mapovaných párov (target 8-cifr): ${pairs.length}`);
  const results = [];
  for (const p of pairs) {
    const ico = p.correct;
    const dbName = nameByWrong[p.wrong] || '(neznáme meno)';
    const entry = { wrong: p.wrong, correct: ico, db_name: dbName, status: '?', reg_names: [] };
    try {
      const res = await fetch(`https://api.statistics.sk/rpo/v1/search?identifier=${ico}`, {
        headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(25000),
      });
      const d = await res.json();
      const exact = (d.results || []).filter(x => (x.identifiers || []).some(i => i.value === ico));
      if (exact.length === 0) {
        entry.status = 'TARGET_NOT_IN_RPO';
      } else {
        const names = [];
        exact.forEach(x => (x.fullNames || []).forEach(n => names.push(n.value)));
        entry.reg_names = names;
        const nd = norm(dbName);
        entry.match = names.some(n => { const nn = norm(n); return nn.includes(nd) || nd.includes(nn); });
        entry.status = entry.match ? 'OK' : 'NAME_DIFF';
      }
    } catch (e) {
      entry.status = 'ERR:' + e.message;
    }
    results.push(entry);
    console.log(`${entry.status}\t${p.wrong} -> ${ico}\t| db="${dbName}"\t| rpo: ${entry.reg_names.join(' | ')}`);
    await sleep(500);
  }
  const bad = results.filter(r => r.status === 'TARGET_NOT_IN_RPO' || r.status === 'NAME_DIFF');
  const err = results.filter(r => r.status.startsWith('ERR'));
  console.log(`\n=== SUMÁR mapy: ${results.length} párov, OK=${results.filter(r => r.status === 'OK').length}, PODOZRIVÉ=${bad.length}, ERR=${err.length} ===`);
  if (bad.length) console.log('PODOZRIVÉ:', JSON.stringify(bad, null, 1));
  fs.writeFileSync('.audit/WATCH217_ico_map_targets.json', JSON.stringify(results, null, 1));
})().catch(e => console.log('FATAL: ' + e.message));
