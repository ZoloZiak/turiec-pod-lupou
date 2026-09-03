// READ-ONLY: parsuj 06_council_votes_seed.sql, vypis distinct mena, distinct hlasovania, sanity sucty
const fs = require('fs');
const path = require('path');
const sql = fs.readFileSync(path.join(__dirname, '..', 'database', '06_council_votes_seed.sql'), 'utf8');
const re = /^\('([^']+)', (NULL|'[^']*'), '([^']+)', '((?:[^']|'')+)', '([^']+)', '([^']+)'\)/gm;
const names = new Map();
const issues = new Map();
const voteCounts = new Map();
let m, total = 0;
while ((m = re.exec(sql)) !== null) {
  total++;
  const name = m[1];
  const vote = m[3];
  const issue = m[4].replace(/''/g, "'");
  const date = m[5];
  names.set(name, (names.get(name) || 0) + 1);
  const ik = date + '||' + issue;
  issues.set(ik, (issues.get(ik) || 0) + 1);
  voteCounts.set(vote, (voteCounts.get(vote) || 0) + 1);
}
console.log('TOTAL parsed rows:', total);
console.log('DISTINCT councillors:', names.size);
console.log('DISTINCT issues (date+title):', issues.size);
console.log('\nVote breakdown:');
for (const [k, v] of [...voteCounts.entries()].sort((a,b)=>b[1]-a[1])) console.log('  ', k, v);
console.log('\nAll councillor names (name: #rows):');
for (const [k, v] of [...names.entries()].sort((a,b)=>a[0].localeCompare(b[0],'sk'))) console.log('  ', k, v);
// rows per issue sanity: kazde hlasovanie by malo mat rovnaky pocet zaznamov (=pocet poslancov v tom zasadnuti)
const perIssue = [...issues.values()];
const uniqCounts = [...new Set(perIssue)].sort((a,b)=>a-b);
console.log('\nRows-per-issue distinct values:', uniqCounts.join(', '));
