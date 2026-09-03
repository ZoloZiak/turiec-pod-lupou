// READ-ONLY: over navrhnute normalizovane IČO proti RPO (ŠÚ SR exact) — zhoda mena.
const fs = require('fs');
const norm = s => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/\b(a\.?\s?s\.?|s\.?\s?r\.?o\.?|v\.?\s?o\.?s\.?|n\.?\s?o\.?|spol\.?|akciov[aá]|spolo[cč]nos[tť])\b/g, ' ')
  .replace(/[^a-z0-9]+/g, ' ').trim();
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function rpo(ico) {
  const res = await fetch(`https://api.statistics.sk/rpo/v1/search?identifier=${ico}`, { headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(15000) });
  const txt = await res.text();
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const d = JSON.parse(txt);
  const exact = (d.results || []).filter(x => (x.identifiers || []).some(i => i.value === ico));
  return [...new Set(exact.flatMap(x => (x.fullNames || []).map(n => n.value)))];
}
(async () => {
  const items = JSON.parse(fs.readFileSync('.audit/WATCH_ico_malformed_impact.json', 'utf8'));
  const out = [];
  for (const r of items) {
    if (!r.proposal || !/^\d{8}$/.test(r.proposal)) { out.push({ ...r, rpo_names: null, verdict: 'MANUAL' }); continue; }
    let rpoNames = [], err = null;
    try { rpoNames = await rpo(r.proposal); } catch (e) { err = String(e.message).slice(0, 80); }
    const target = norm(r.name);
    const match = rpoNames.some(n => norm(n) === target || norm(n).includes(target) || target.includes(norm(n)));
    out.push({ ico: r.ico, proposal: r.proposal, name: r.name, category: r.category, collision: r.collision, total_tx: r.total_tx, rpo_names: rpoNames, err, verdict: err ? 'RPOERR' : (rpoNames.length === 0 ? 'RPO_NOTFOUND' : (match ? 'OK' : 'NAME_DIFF')) });
    console.log(`${out[out.length - 1].verdict}\t"${r.ico}"->${r.proposal}\t${r.name}\n   RPO: ${JSON.stringify(rpoNames)}`);
    await sleep(300);
  }
  fs.writeFileSync('.audit/WATCH_ico_malformed_rpo.json', JSON.stringify(out, null, 2));
  const c = {}; for (const r of out) c[r.verdict] = (c[r.verdict] || 0) + 1;
  console.log('\nVERDICTS: ' + JSON.stringify(c));
})();
