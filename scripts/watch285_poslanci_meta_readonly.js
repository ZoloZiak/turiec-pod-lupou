// READ-ONLY: WATCH #285 stráž STRÁNKA /poslanci — distinct poslanci, distinct source_url,
// fabrikačné mená, neutrálny badge. Žiadny zápis, žiadny fetch (linky curl-om zvlášť).
const fs = require('fs');
const j = JSON.parse(fs.readFileSync('/tmp/prod_votes.json', 'utf8'));
const rows = j.rows;

const names = new Set(), urls = new Set(), sources = new Set();
let nullUrl = 0, emptyName = 0;
const fabRe = /(Ing\.\s*Ján Kováč|MUDr\.\s*Peter Novák|\btest\b|dummy|mock|sample|ilustr|vzorov)/i;
const fabHits = [];
for (const r of rows) {
  if (r.councillor_name) names.add(r.councillor_name); else emptyName++;
  if (r.source_url) urls.add(r.source_url); else nullUrl++;
  if (r.source) sources.add(r.source);
  if (fabRe.test(r.councillor_name || '') || fabRe.test(r.issue_title || '')) fabHits.push(r.councillor_name + ' | ' + r.issue_title);
}
console.log('total rows:', rows.length);
console.log('distinct poslanci:', names.size);
console.log('distinct source_url:', urls.size);
console.log('distinct source label:', [...sources].join(' ; '));
console.log('null source_url:', nullUrl, '| empty name:', emptyName);
console.log('fabrikačné mená/tituly hits:', fabHits.length);
if (fabHits.length) console.log(fabHits.slice(0, 10).join('\n'));
console.log('--- distinct source_url ---');
console.log([...urls].join('\n'));
