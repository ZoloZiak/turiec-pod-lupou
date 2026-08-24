// READ-ONLY batch verify: first 40 items of .audit/DV-ICO-ALL_set.json
// Sources: RPO ŠÚ SR (api.statistics.sk) + RÚZ (registeruz.sk API)
const fs = require('fs');
const path = '/Users/ziak.z/projects/turiec-pod-lupou/.audit/DV-ICO-ALL_set.json';
const N = 40, THROTTLE = 150;

const norm = s => (s || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/\b(a\.?\s?s\.?|s\.?\s?r\.?\s?o\.?|v\.?\s?o\.?s\.?|n\.?\s?o\.?|z\.?\s?p\.?|p\.?\s?r\.?|k\.?\s?s\.?|f\.?\s?a\.?|š\.?\s?p\.?)\b/g, ' ')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function jget(url, headers = {}) {
  const res = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0', ...headers }, signal: AbortSignal.timeout(15000) });
  const txt = await res.text();
  if (!res.ok) throw new Error('HTTP ' + res.status + ': ' + txt.slice(0, 120));
  try { return JSON.parse(txt); } catch { throw new Error('nonJSON: ' + txt.slice(0, 80)); }
}

(async () => {
  const items = JSON.parse(fs.readFileSync(path, 'utf8')).items.slice(0, N);
  const results = [];
  for (const it of items) {
    const r = { ico: it.ico, db_name: it.name, status: null, rpo_names: [], ruz_names: [] };
    // RPO
    try {
      const d = await jget(`https://api.statistics.sk/rpo/v1/search?identifier=${it.ico}`);
      const exact = (d.results || []).filter(x => (x.identifiers || []).some(i => i.value === it.ico));
      r.rpo_names = [...new Set(exact.flatMap(x => (x.fullNames || []).map(n => n.value)))];
    } catch (e) { r.rpo_err = String(e.message).slice(0, 100); }
    // RÚZ (WAF-blokované) → fallback ORSR web
    try {
      const res = await fetch(`https://www.orsr.sk/hladaj_ico.asp?ICO=${it.ico}&SID=0`, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(15000) });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const html = new TextDecoder('windows-1250').decode(await res.arrayBuffer());
      r.ruz_names = [...new Set([...html.matchAll(/vypis\.asp\?[^>]*>([^<]{2,120})<\/a>/g)].map(m => m[1].trim()).filter(t => t.length > 3))];
    } catch (e) { r.ruz_err = String(e.message).slice(0, 100); }

    if (r.rpo_err && !r.rpo_names.length) r.status = 'APIERR';
    else if (!r.rpo_names.length && !r.ruz_names.length) r.status = 'NOTFOUND';
    else if (!r.ruz_names.length && (r.ruz_err || r.rpo_err)) r.status = 'ONE_SOURCE';
    else if (!r.rpo_names.length) r.status = 'ONE_SOURCE';

    if (!r.status) {
      const target = norm(it.name);
      const okRpo = r.rpo_names.some(n => norm(n) === target);
      const okRuz = r.ruz_names.some(n => norm(n) === target);
      r.status = (okRpo && (okRuz || !r.ruz_names.length)) ? 'OK' : (okRpo || okRuz ? 'MISMATCH' : 'MISMATCH');
      if (okRpo && okRuz) r.status = 'OK';
    }
    results.push(r);
    console.error(`${results.length}/${N} ${it.ico} ${r.status}`);
    await sleep(THROTTLE);
  }
  fs.writeFileSync('/tmp/dv_ico_batch_0_39.json', JSON.stringify(results, null, 2));
  const counts = {};
  for (const r of results) counts[r.status] = (counts[r.status] || 0) + 1;
  console.log(JSON.stringify({ counts, nonOk: results.filter(r => r.status !== 'OK') }, null, 2));
})();
