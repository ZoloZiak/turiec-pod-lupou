// READ-ONLY WATCH #278 — 2-zdrojové doriešenie 12 "podozrivých" IČO z okna 40-59.
// Pre každé IČO: (1) RE-FETCH RPO ŠÚ SR priamo (kontrola transientu/rate-limitu),
// (2) nezávislý 2. zdroj RÚZ registeruz.sk (uctovne-jednotky?ico=... -> detail nazovUJ).
// Cieľ: rozlíšiť "subjekt nie je v RPO (legit)" od "chybné IČO (regresia)".
// Nič nemení v DB. Zapíše .audit/WATCH278_ico_verify.json.
require('dotenv').config({ path: '.env.local' });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const fs = require('fs');
const path = require('path');

const CANDIDATES = [
  { ico: '00685852', db: 'Messer Tatragas, spol. s r. o.' },
  { ico: '00686832', db: 'Ministerstvo hospodárstva Slovenskej republiky' },
  { ico: '14225557', db: 'Urbár Martin, pozemkové spoločenstvo' },
  { ico: '15030865', db: 'SOR Libchavy spol. sr.o.' },
  { ico: '15547591', db: 'HUBER CS spol. s r.o.' },
  { ico: '17050499', db: 'Spojená škola' },
  { ico: '17067464', db: 'Rímskokatolícka cirkev, farnosť Martin' },
  { ico: '22664980', db: 'Základná organizácia SLOVES pri mestskom úrade Martin' },
  { ico: '27427889', db: 'IBOS a.s.' },
  { ico: '30416094', db: 'Ministerstvo dopravy SR' },
  { ico: '30794536', db: 'Úrad práce, sociálnych vecí a rodiny Žilina' },
  { ico: '30796491', db: 'Enviromentálny fond' },
];

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function rpo(ico) {
  try {
    const res = await fetch(`https://api.statistics.sk/rpo/v1/search?identifier=${ico}`, {
      headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(25000),
    });
    if (!res.ok) return { http: res.status, names: [] };
    const d = await res.json();
    const exact = (d.results || []).filter(x => (x.identifiers || []).some(i => String(i.value) === String(ico)));
    const names = [];
    exact.forEach(x => (x.fullNames || []).forEach(n => names.push(n.value)));
    return { http: 200, total: (d.results || []).length, exactCount: exact.length, names };
  } catch (e) { return { http: 'ERR', err: e.message, names: [] }; }
}

async function ruz(ico) {
  try {
    const r1 = await fetch(`https://www.registeruz.sk/cruz-public/api/uctovne-jednotky?zmenene-od=1900-01-01&ico=${ico}`, {
      headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(25000),
    });
    if (!r1.ok) return { http: r1.status, ids: [] };
    const d1 = await r1.json();
    const ids = Array.isArray(d1.id) ? d1.id : [];
    if (!ids.length) return { http: 200, ids: [], name: null };
    const r2 = await fetch(`https://www.registeruz.sk/cruz-public/api/uctovna-jednotka?id=${ids[0]}`, {
      headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(25000),
    });
    const d2 = r2.ok ? await r2.json() : {};
    return { http: 200, ids, name: d2.nazovUJ || null, mesto: d2.mesto || null, ulica: d2.ulica || null, pravnaForma: d2.pravnaForma || null };
  } catch (e) { return { http: 'ERR', err: e.message, ids: [] }; }
}

(async () => {
  const out = [];
  for (const c of CANDIDATES) {
    const rp = await rpo(c.ico);
    await sleep(400);
    const rz = await ruz(c.ico);
    await sleep(400);
    let verdict;
    const foundRpo = rp.exactCount > 0;
    const foundRuz = (rz.ids || []).length > 0;
    if (foundRpo || foundRuz) verdict = 'ICO_PLATNE'; // aspoň jeden štátny register potvrdil existenciu IČO
    else verdict = 'NENAJDENE_ANI_JEDEN'; // ani RPO ani RÚZ -> hlbšie preskúmať
    out.push({ ico: c.ico, db: c.db, verdict, rpo_names: rp.names, rpo_exact: rp.exactCount, rpo_http: rp.http, ruz_name: rz.name, ruz_ids: (rz.ids || []).length, ruz_mesto: rz.mesto, ruz_http: rz.http });
    console.log(`${verdict}\t${c.ico}\t${c.db}\n   RPO(exact=${rp.exactCount}): ${rp.names.join(' | ') || '—'}\n   RÚZ(ids=${(rz.ids||[]).length}): ${rz.name || '—'} ${rz.mesto ? '['+rz.mesto+']' : ''}`);
  }
  fs.writeFileSync(path.join(__dirname, '..', '.audit', 'WATCH278_ico_verify.json'), JSON.stringify(out, null, 1));
  const nen = out.filter(o => o.verdict === 'NENAJDENE_ANI_JEDEN');
  console.log(`\n=== SUMÁR: ${out.length} kandidátov | ICO_PLATNE(aspoň 1 register)=${out.length - nen.length} | NENAJDENE_ANI_JEDEN=${nen.length} ===`);
  if (nen.length) console.log('POZOR nenájdené ani v RPO ani v RÚZ:', nen.map(o => o.ico + ' ' + o.db).join(', '));
})().catch(e => console.log('FATAL: ' + e.message));
