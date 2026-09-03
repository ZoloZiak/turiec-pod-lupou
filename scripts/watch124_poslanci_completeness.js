// READ-ONLY: over uplnost hlasovani vs ocakavanie — je chybajuce hlasovanie aj inde?
// Pozri titul-format v DB (ci scraper vie rozlisit hlasovania) + skontroluj 29.01 a 26.03 uplnost.
const fs = require('fs');
const j = JSON.parse(fs.readFileSync('/tmp/prod_votes.json', 'utf8'));
const rows = j.rows;
for (const d of ['2026-01-29','2026-02-19','2026-03-26']) {
  const r = rows.filter(x => x.vote_date === d);
  const issues = new Set(r.map(x => x.issue_title));
  console.log(`${d}: ${r.length} riadkov, ${issues.size} hlasovani, ${r.length/31} (/31)`);
}
// vypis vsetky tituly 19.02 s cislom uznesenia extrahovanym
console.log('\n--- 19.02 tituly (poradie uzneseni) ---');
const r19 = rows.filter(x => x.vote_date === '2026-02-19');
const titles = [...new Set(r19.map(x => x.issue_title))];
const uzn = titles.map(t => { const m = t.match(/Uznesenie č\.\s*(\d+)\/2026/); return m ? parseInt(m[1]) : null; }).filter(x=>x!==null).sort((a,b)=>a-b);
console.log('cisla uzneseni v DB:', [...new Set(uzn)].join(', '));
console.log('PDF ma uznesenia: 19,20,21,22,23,24,25,26,27,28,29,30,31 (13 distinct uzneseni, 16 hlasovani lebo uzn 20 = 4 hlasovania)');
