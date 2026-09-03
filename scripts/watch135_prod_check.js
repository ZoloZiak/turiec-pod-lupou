// READ-ONLY: over zivu produkciu eu_funds (ulozene /tmp/prod_eu135.json) proti DB pravde.
const fs = require('fs');
const j = JSON.parse(fs.readFileSync('/tmp/prod_eu135.json', 'utf8'));
console.log('success:', j.success, '| rows:', (j.rows || []).length);
let sum = 0; const icos = {};
for (const r of (j.rows || [])) {
  sum += Number(r.amount_eur) || 0;
  icos[r.winner_ico] = (icos[r.winner_ico] || 0) + 1;
}
console.log('SUM:', sum.toFixed(2));
console.log('ICO distrib:', JSON.stringify(icos));
// fabrikacne signatury
const suspicious = (j.rows || []).filter(r => /live crawl|dummy|mock|sample|vyextrahovan|simul/i.test(JSON.stringify(r)));
console.log('suspicious rows:', suspicious.length);
const badAmt = (j.rows || []).filter(r => r.amount_eur == null || isNaN(Number(r.amount_eur)));
console.log('bad amount rows:', badAmt.length);
