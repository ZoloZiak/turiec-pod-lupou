// READ-ONLY: over produkčný /api/dataset?table=eu_funds JSON — count, SUM, distribúcia, fabrikát.
const fs = require('fs');
const j = JSON.parse(fs.readFileSync('/tmp/prod_eu256.json', 'utf8'));
const rows = j.rows || [];
let sum = 0; const dist = {}; let fab = 0, bad = 0, noIco = 0;
const FAB = /live crawl|dummy|mock|sample|ilustr|simul|placeholder|vyextrahovan|math\.random/i;
for (const r of rows) {
  const a = Number(r.amount_eur);
  if (!Number.isFinite(a) || a < 0) bad++; else sum += a;
  if (!r.winner_ico) noIco++; else dist[r.winner_ico] = (dist[r.winner_ico] || 0) + 1;
  if (FAB.test([r.winner_name, r.project_name, r.program_name].join(' '))) fab++;
}
console.log('success:', j.success, '| rows:', rows.length);
console.log('SUM:', sum.toFixed(2));
console.log('distrib:', JSON.stringify(dist));
console.log('bad:', bad, '| noIco:', noIco, '| fab:', fab);
