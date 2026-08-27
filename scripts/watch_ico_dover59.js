// READ-ONLY dover podozrivých z WATCH #59.
require('dotenv').config({ path: '.env.local' });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function jget(url) {
  const res = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(25000) });
  const txt = await res.text();
  return { ok: res.ok, status: res.status, txt };
}

(async () => {
  // 1) 00216822 Obec Nolčovo — identifier exact + fulltext podľa názvu (nájdi skutočné IČO)
  console.log('=== 00216822 (DB: Obec Nolčovo) identifier ===');
  try {
    const r = await jget('https://api.statistics.sk/rpo/v1/search?identifier=00216822');
    let d = {}; try { d = JSON.parse(r.txt); } catch {}
    const exact = (d.results || []).filter(x => (x.identifiers || []).some(i => i.value === '00216822'));
    console.log('exact results:', exact.length, exact.map(x => ({ names: (x.fullNames||[]).map(n=>n.value), ids: (x.identifiers||[]).map(i=>i.value) })));
    console.log('raw total results:', (d.results||[]).length);
  } catch (e) { console.log('ERR:', e.message); }
  await sleep(600);

  console.log('\n=== fulltext "Nolčovo" (nájdi skutočné IČO obce) ===');
  try {
    const r = await jget('https://api.statistics.sk/rpo/v1/search?fullName=Obec%20Nol%C4%8Dovo');
    let d = {}; try { d = JSON.parse(r.txt); } catch {}
    console.log('status', r.status, 'hits', (d.results||[]).length);
    (d.results||[]).slice(0,6).forEach(x => console.log('  ', (x.fullNames||[]).map(n=>n.value).join('/'), '| IČO:', (x.identifiers||[]).map(i=>i.value).join(',')));
  } catch (e) { console.log('ERR:', e.message); }
  await sleep(600);

  // 2) 31645640 FROST - service (timeout re-check)
  console.log('\n=== 31645640 (DB: FROST - service s.r.o.) re-check ===');
  try {
    const r = await jget('https://api.statistics.sk/rpo/v1/search?identifier=31645640');
    let d = {}; try { d = JSON.parse(r.txt); } catch {}
    const exact = (d.results || []).filter(x => (x.identifiers || []).some(i => i.value === '31645640'));
    console.log('exact:', exact.map(x => (x.fullNames||[]).map(n=>n.value)));
  } catch (e) { console.log('ERR:', e.message); }
  await sleep(600);

  // 3) 22664980 SLOVES ZO — detail (zdieľa IČO materský zväz?)
  console.log('\n=== 22664980 (DB: ZO SLOVES pri MsÚ Martin) detail ===');
  try {
    const r = await jget('https://api.statistics.sk/rpo/v1/search?identifier=22664980');
    let d = {}; try { d = JSON.parse(r.txt); } catch {}
    const exact = (d.results || []).filter(x => (x.identifiers || []).some(i => i.value === '22664980'));
    exact.forEach(x => console.log('  names:', (x.fullNames||[]).map(n=>n.value), '| legalForm:', x.legalForms && x.legalForms.map(l=>l.value), '| addr:', x.addresses && x.addresses.map(a=>a.municipality && a.municipality.value)));
  } catch (e) { console.log('ERR:', e.message); }
})().catch(e => console.log('FATAL: ' + e.message));
