// READ-ONLY WATCH #133: over že KAŽDÝ živý malformed IČO string z DB je PRESNE (whitespace-sensitive)
// pokrytý kľúčom v ICO_CORRECTIONS (entity-ico-fixes.ts), alebo je MULTI/invalid a drží ho isValidIco guard.
// Chytí regresiu: Krtko cez noc pridal NOVÝ malformed tvar, ktorý mapa nepokrýva -> unikol by na web.
const fs = require('fs');
const impact = JSON.parse(fs.readFileSync('.audit/WATCH_ico_malformed_impact.json', 'utf8'));
const src = fs.readFileSync('src/lib/entity-ico-fixes.ts', 'utf8');

// vytiahni kľúče z ICO_CORRECTIONS bloku (medzi 'const ICO_CORRECTIONS' a uzatváracou '};')
const block = src.slice(src.indexOf('const ICO_CORRECTIONS'), src.indexOf('};', src.indexOf('const ICO_CORRECTIONS')));
const keys = new Set();
const re = /^\s*'((?:[^'\\]|\\.)*)'\s*:/gm;
let m;
while ((m = re.exec(block)) !== null) keys.add(m[1].replace(/\\'/g, "'"));
console.log('ICO_CORRECTIONS kľúčov: ' + keys.size);

const isValid = s => /^\d{8}$/.test(s);
const report = [];
for (const r of impact) {
  const ico = r.ico;
  const mapped = keys.has(ico);
  const valid8 = isValid(ico);
  let verdict;
  if (mapped) verdict = 'MAP_OK';        // pokryté read-time korekciou
  else if (!valid8) verdict = 'GUARD_OK'; // nie je 8-cifr -> isValidIco blokuje web linky (MULTI/short/long)
  else verdict = 'UNCOVERED_RISK';        // 8-cifr, nie v mape -> mohol by uniknúť ako zlý link
  report.push({ ico, name: r.name, tx: r.total_tx, mapped, valid8, verdict });
}
console.log('\nico | verdict | tx | name');
for (const r of report) console.log(`"${r.ico}" | ${r.verdict} | tx=${r.tx} | ${r.name}`);

const risk = report.filter(r => r.verdict === 'UNCOVERED_RISK');
console.log('\nUNCOVERED_RISK (8-cifr mimo mapy, potenciálny zlý web link): ' + risk.length);

// orphan kľúče: mapa má kľúč, ale v DB už taká malformed entita nie je (info, nie chyba)
const liveStrings = new Set(impact.map(r => r.ico));
const orphanKeys = [...keys].filter(k => !liveStrings.has(k) && k !== '00216822'); // Nolčovo je špec. (read-time typo, nie enumerovaný ako malformed entity)
console.log('\nMapové kľúče bez živej malformed entity (info): ' + orphanKeys.length + ' -> ' + JSON.stringify(orphanKeys));

fs.writeFileSync('.audit/WATCH133_ico_coverage.json', JSON.stringify(report, null, 2));
