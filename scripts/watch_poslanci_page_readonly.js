// READ-ONLY: analyzuj zivy dataset city_council_votes z produkcie (/tmp/prod_votes.json)
// WATCH stráž STRÁNKA /poslanci. Ziadny zapis do DB.
const fs = require('fs');
const j = JSON.parse(fs.readFileSync('/tmp/prod_votes.json', 'utf8'));
if (!j.success) { console.log('API not success:', j.error); process.exit(1); }
const rows = j.rows;
console.log('TOTAL votes rows:', rows.length);

// distinct poslanci
const councillors = new Map();
const dates = new Set();
const issues = new Set();
const voteCasts = new Map();
const sources = new Map();
let nullSource = 0, emptyName = 0, emptyIssue = 0;

for (const r of rows) {
  councillors.set(r.councillor_name, (councillors.get(r.councillor_name) || 0) + 1);
  dates.add(r.vote_date);
  issues.add(`${r.vote_date}||${r.issue_title}`);
  voteCasts.set(r.vote_cast, (voteCasts.get(r.vote_cast) || 0) + 1);
  if (!r.source_url) nullSource++; else sources.set(r.source_url, (sources.get(r.source_url) || 0) + 1);
  if (!r.councillor_name || !r.councillor_name.trim()) emptyName++;
  if (!r.issue_title || !r.issue_title.trim()) emptyIssue++;
}

console.log('distinct councillors:', councillors.size);
console.log('distinct dates:', [...dates].sort());
console.log('distinct issues (date||title):', issues.size);
console.log('vote_cast distribution:', Object.fromEntries(voteCasts));
console.log('null source_url rows:', nullSource, '| empty name:', emptyName, '| empty issue:', emptyIssue);
console.log('distinct source_urls:');
for (const [u, c] of sources) console.log('  ', c, u);

// fabrikacne signatury v menach
const suspectNames = [...councillors.keys()].filter(n =>
  /Ing\.\s*Ján Kováč|MUDr\.\s*Peter Novák|test|dummy|mock|vzor|placeholder|example|N\/A|Lorem/i.test(n || ''));
console.log('SUSPECT names (cyklus1 fabrikaty):', suspectNames);

// per-issue vote count sanity (kazde hlasovanie by malo mat podobny pocet poslancov ~31)
const perIssue = new Map();
for (const r of rows) {
  const k = `${r.vote_date}||${r.issue_title}`;
  perIssue.set(k, (perIssue.get(k) || 0) + 1);
}
const counts = [...perIssue.values()];
counts.sort((a,b)=>a-b);
console.log('votes-per-issue: min', counts[0], 'max', counts[counts.length-1], 'median', counts[Math.floor(counts.length/2)], 'issues', counts.length);
// vypis anomalne (mimo 20-35)
const anom = [...perIssue.entries()].filter(([,c]) => c < 20 || c > 35);
console.log('anomalne pocty (mimo 20-35):', anom.length);
for (const [k,c] of anom.slice(0,10)) console.log('  ', c, k.slice(0,80));

// zoznam vsetkych poslancov s poctom hlasov
console.log('--- councillors (name: count) ---');
for (const [n,c] of [...councillors.entries()].sort((a,b)=>a[1]-b[1])) console.log(`  ${n}: ${c}`);
