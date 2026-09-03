// overí live Vercel /api/dataset?table=eu_funds proti DB pravde
const fs = require('fs');
const j = JSON.parse(fs.readFileSync('/tmp/prod_eu.json', 'utf8'));
console.log('success:', j.success, '| rows:', (j.rows || []).length);
let sum = 0; const icos = new Map();
for (const r of j.rows || []) {
  sum += Number(r.amount_eur) || 0;
  icos.set(r.winner_ico, (icos.get(r.winner_ico) || 0) + 1);
}
console.log('PROD SUM amount_eur:', sum.toFixed(2));
console.log('PROD distinct winner_ico:');
for (const [k, v] of icos.entries()) console.log('  ', k, v);
console.log('DB pravda (watch_eu_funds): 20 rows, SUM 17046845.73, 53560922:4 00316792:12 36672084:4');
