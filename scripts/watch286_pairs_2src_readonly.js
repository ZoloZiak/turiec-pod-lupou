// READ-ONLY WATCH #286 — 2-ZDROJOVÉ (RPO + RÚZ) doriešenie 4 SK kolízií malformed IČO.
// Kandidáti = short6 orphan IČO ktoré majú v DB kanonickú clean entitu s reálnym IČO.
// Dlhé sleepy kvôli RPO rate-limitu. Nič nemení v DB.
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const fs = require('fs');
const PAIRS = [
  { wrong: '585441', pad: '00585441', db: 'KOOPERATIVA poisťovňa, a.s. Vienna Insurance Group' },
  { wrong: '316792', pad: '00316792', db: 'Mesto Martin' },
  { wrong: '685852', pad: '00685852', db: 'Messer Tatragas, spol. s r.o.' },
  { wrong: '151653', pad: '00151653', db: 'Slovenská sporiteľňa, a.s.' },
];
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function rpo(ico) {
  try {
    const res = await fetch(`https://api.statistics.sk/rpo/v1/search?identifier=${ico}`, {
      headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(30000) });
    if (!res.ok) return { http: res.status, names: [] };
    const d = await res.json();
    const exact = (d.results || []).filter(x => (x.identifiers || []).some(i => String(i.value) === String(ico)));
    const names = []; exact.forEach(x => (x.fullNames || []).forEach(n => names.push(n.value)));
    return { http: 200, exactCount: exact.length, names };
  } catch (e) { return { http: 'ERR', err: e.message, names: [] }; }
}
async function ruz(ico) {
  try {
    const r1 = await fetch(`https://www.registeruz.sk/cruz-public/api/uctovne-jednotky?zmenene-od=1900-01-01&ico=${ico}`, {
      headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(30000) });
    if (!r1.ok) return { http: r1.status, ids: [] };
    const d1 = await r1.json();
    const ids = Array.isArray(d1.id) ? d1.id : [];
    if (!ids.length) return { http: 200, ids: [], name: null };
    const r2 = await fetch(`https://www.registeruz.sk/cruz-public/api/uctovna-jednotka?id=${ids[0]}`, {
      headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(30000) });
    const d2 = r2.ok ? await r2.json() : {};
    return { http: 200, ids, name: d2.nazovUJ || null, mesto: d2.mesto || null };
  } catch (e) { return { http: 'ERR', err: e.message, ids: [] }; }
}
(async () => {
  const out = [];
  for (const p of PAIRS) {
    const rp = await rpo(p.pad); await sleep(3000);
    const rz = await ruz(p.pad); await sleep(3000);
    const rpoOk = rp.exactCount > 0;
    const ruzOk = (rz.ids || []).length > 0;
    const verdict = (rpoOk && ruzOk) ? 'OVERENE_2Z' : (rpoOk || ruzOk) ? 'OVERENE_1Z' : 'NENAJDENE';
    out.push({ wrong: p.wrong, pad: p.pad, db: p.db, verdict, rpo_exact: rp.exactCount, rpo_names: rp.names, rpo_http: rp.http, ruz_name: rz.name, ruz_mesto: rz.mesto, ruz_ids: (rz.ids || []).length, ruz_http: rz.http });
    console.log(`${verdict}\t${p.wrong}->${p.pad} (${p.db})\n  RPO exact=${rp.exactCount}: ${rp.names.join(' | ') || '—'}\n  RÚZ ids=${(rz.ids||[]).length}: ${rz.name || '—'} ${rz.mesto ? '['+rz.mesto+']' : ''}`);
  }
  fs.writeFileSync('.audit/WATCH286_pairs_2src.json', JSON.stringify(out, null, 2));
  console.log('\n=== ' + out.filter(o => o.verdict === 'OVERENE_2Z').length + '/4 overené 2-zdrojovo ===');
})().catch(e => console.log('FATAL: ' + e.message));
