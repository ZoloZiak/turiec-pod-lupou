// READ-ONLY: extrahuj DB kauzy pre 26.03.2026 a ich summary (ZA/PROTI/...) na porovnanie s H.E.R. PDF
const fs = require('fs');
const j = JSON.parse(fs.readFileSync('/tmp/prod_votes.json', 'utf8'));
const rows = j.rows.filter(r => r.vote_date === '2026-03-26');
console.log('26.03.2026 rows:', rows.length);

const map = new Map();
for (const r of rows) {
  if (!map.has(r.issue_title)) map.set(r.issue_title, {});
  const s = map.get(r.issue_title);
  s[r.vote_cast] = (s[r.vote_cast] || 0) + 1;
}
console.log('distinct issues 26.03:', map.size);
let idx = 0;
for (const [title, s] of map) {
  const total = Object.values(s).reduce((a,b)=>a+b,0);
  console.log(`\n[${++idx}] ${title}`);
  console.log('   ', JSON.stringify(s), 'total=', total);
}
