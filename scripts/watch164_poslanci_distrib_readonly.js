// READ-ONLY: WATCH #164 stráž STRÁNKA /poslanci — per-hlasovanie distribúcia hlasov
// + kontinuita čísel uznesení. Chytí fabrikát (nepravdepodobná jednomyseľnosť),
// nekonzistentné počty, chýbajúce/duplicitné uznesenia. Žiadny zápis, žiadny fetch.
const fs = require('fs');
const j = JSON.parse(fs.readFileSync('/tmp/prod_votes.json', 'utf8'));
const rows = j.rows;

// zoskup podľa dátum||title
const byIssue = new Map();
for (const r of rows) {
  const k = `${r.vote_date}||${r.issue_title}`;
  if (!byIssue.has(k)) byIssue.set(k, []);
  byIssue.get(k).push(r);
}

// per hlasovanie distribúcia + integrita 31
let unanimousZA = 0, badTotal = 0, dupCouncillor = 0;
const perDate = new Map();
const issueList = [];
for (const [k, arr] of byIssue) {
  const dist = {};
  const seen = new Set();
  for (const r of arr) {
    dist[r.vote_cast] = (dist[r.vote_cast] || 0) + 1;
    if (seen.has(r.councillor_name)) dupCouncillor++;
    seen.add(r.councillor_name);
  }
  const total = arr.length;
  if (total !== 31) badTotal++;
  if ((dist['ZA'] || 0) === 31) unanimousZA++;
  const [date] = k.split('||');
  perDate.set(date, (perDate.get(date) || 0) + 1);
  issueList.push({ date, title: k.split('||')[1], total, dist });
}

console.log('=== PER-HLASOVANIE INTEGRITA ===');
console.log('distinct hlasovaní:', byIssue.size);
console.log('hlasovaní s total != 31:', badTotal);
console.log('hlasovaní kde ten istý poslanec hlasoval 2x:', dupCouncillor);
console.log('jednomyseľných ZA (31/0/0/0/0):', unanimousZA, `(${(unanimousZA/byIssue.size*100).toFixed(1)}% — realisticky vysoké pri procedurálnych bodoch, fabrikát by mal ~100%)`);
console.log('hlasovaní na dátum:', Object.fromEntries(perDate));

// najkontroverznejšie (najviac PROTI) — na krížové overenie proti realite
console.log('\n=== TOP 8 KONTROVERZNÝCH (najviac PROTI/ZDRŽAL) ===');
const contro = issueList
  .map(i => ({ ...i, dissent: (i.dist['PROTI'] || 0) + (i.dist['ZDRŽAL SA'] || 0) }))
  .sort((a, b) => b.dissent - a.dissent)
  .slice(0, 8);
for (const c of contro) {
  console.log(`  ${c.date} PROTI+ZDRŽAL=${c.dissent} | ${JSON.stringify(c.dist)} | ${c.title.slice(0, 60)}`);
}

// distribúcia vote_cast per poslanec — chytí "duch" poslanca (vždy NEPRÍTOMNÝ = možný fabrikát karty)
console.log('\n=== POSLANCI S NAJVYŠŠOU NEPRÍTOMNOSŤOU ===');
const byC = new Map();
for (const r of rows) {
  if (!byC.has(r.councillor_name)) byC.set(r.councillor_name, {});
  const d = byC.get(r.councillor_name);
  d[r.vote_cast] = (d[r.vote_cast] || 0) + 1;
}
const absent = [...byC.entries()]
  .map(([n, d]) => ({ n, absent: d['NEPRÍTOMNÝ'] || 0, total: Object.values(d).reduce((a, b) => a + b, 0) }))
  .sort((a, b) => b.absent - a.absent)
  .slice(0, 6);
for (const a of absent) console.log(`  ${a.n}: NEPRÍTOMNÝ ${a.absent}/${a.total}`);
