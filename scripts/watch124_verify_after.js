const fs = require('fs');
const j = JSON.parse(fs.readFileSync('/tmp/prod_votes2.json', 'utf8'));
const rows = j.rows;
console.log('TOTAL rows:', rows.length, '(malo byt 1643)');
for (const d of ['2026-01-29','2026-02-19','2026-03-26']) {
  const r = rows.filter(x => x.vote_date === d);
  const issues = new Set(r.map(x => x.issue_title));
  console.log(`${d}: ${r.length} riadkov, ${issues.size} hlasovani`);
}
// over uzn 19
const u19 = rows.filter(x => x.vote_date==='2026-02-19' && x.issue_title.includes('19/2026'));
const casts = {};
for (const r of u19) casts[r.vote_cast]=(casts[r.vote_cast]||0)+1;
console.log('uzn 19/2026 v DB:', u19.length, 'riadkov, rozklad:', casts);
// integrita: kazde hlasovanie stale presne 31?
const perIssue = new Map();
for (const r of rows) { const k=`${r.vote_date}||${r.issue_title}`; perIssue.set(k,(perIssue.get(k)||0)+1); }
const counts=[...perIssue.values()].sort((a,b)=>a-b);
console.log('votes-per-issue: min',counts[0],'max',counts[counts.length-1],'issues',counts.length);
// fabrikaty
const susp=[...new Set(rows.map(r=>r.councillor_name))].filter(n=>/test|dummy|mock|Kováč|Novák/i.test(n));
console.log('distinct councillors:',new Set(rows.map(r=>r.councillor_name)).size,'| suspect:',susp);
