// READ-ONLY: porovnaj DB hlasovania 2026-02-19 (z /tmp/prod_votes.json) s oficialnym H.E.R. PDF.
// WATCH #124 straz STRANKA /poslanci — hlbkove overenie datumu 19.02 (baseline #92 overil len 26.03/29.01).
// Ziadny zapis do DB.
const fs = require('fs');
const j = JSON.parse(fs.readFileSync('/tmp/prod_votes.json', 'utf8'));
const rows = j.rows.filter(r => r.vote_date === '2026-02-19');
console.log('DB rows pre 2026-02-19:', rows.length, '=> hlasovani (/31):', rows.length / 31);

// distinct issue_title + pocet + vote distribution
const byIssue = new Map();
for (const r of rows) {
  const k = r.issue_title;
  if (!byIssue.has(k)) byIssue.set(k, { count: 0, casts: {} });
  const e = byIssue.get(k);
  e.count++;
  e.casts[r.vote_cast] = (e.casts[r.vote_cast] || 0) + 1;
}
console.log('DISTINCT issue_title pre 19.02:', byIssue.size);
console.log('--- DB hlasovania (title | pocet | ZA/PROTI/ZDRZAL/NEHLAS/NEPRIT) ---');
let idx = 0;
for (const [t, e] of byIssue) {
  idx++;
  const c = e.casts;
  console.log(`${idx}. [${e.count}] ZA=${c['ZA']||0} PROTI=${c['PROTI']||0} ZDRZ=${c['ZDRŽAL SA']||0} NEHL=${c['NEHLASOVAL']||0} NEPR=${c['NEPRÍTOMNÝ']||0} | ${t}`);
}
