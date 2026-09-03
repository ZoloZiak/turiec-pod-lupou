// READ-ONLY: overenie MENOVITYCH hlasov 2 kontroverznych hlasovani 19.02 proti H.E.R. PDF.
// WATCH #124. Ziadny zapis.
const fs = require('fs');
const j = JSON.parse(fs.readFileSync('/tmp/prod_votes.json', 'utf8'));
const rows = j.rows.filter(r => r.vote_date === '2026-02-19');

// PDF ground truth: hlas.17 (Uzn 20/26 DPMM Kollár) — PROTI a ZDRZAL mena
const pdf_h17_proti = ['Martina Antošová','Milan Ftorek','Veronika Gajdošová Ladňáková','Filip Horanský','Tomáš Ignačák','Martin Lepej','Juraj Marček','Andrej Rodák','Juraj Stahl','Michal Uherčík'];
const pdf_h17_zdrzal = ['Michal Matejička'];
// PDF hlas.23 (Uzn 30/2026) — PROTI mena
const pdf_h23_proti = ['Martina Antošová','Marek Belák','Milan Ftorek','Filip Horanský','Tomáš Ignačák','Martin Lepej','Juraj Marček','Andrej Rodák','Juraj Stahl','Michal Uherčík'];

function check(titleSubstr, label, pdfProti, pdfZdrzal) {
  const r = rows.filter(x => x.issue_title.includes(titleSubstr));
  const dbProti = r.filter(x => x.vote_cast === 'PROTI').map(x => x.councillor_name).sort();
  const dbZdrzal = r.filter(x => x.vote_cast === 'ZDRŽAL SA').map(x => x.councillor_name).sort();
  const ep = [...pdfProti].sort(), ez = [...(pdfZdrzal||[])].sort();
  const protiMatch = JSON.stringify(dbProti) === JSON.stringify(ep);
  const zdrzalMatch = JSON.stringify(dbZdrzal) === JSON.stringify(ez);
  console.log(`\n=== ${label} (${r.length} riadkov) ===`);
  console.log('PROTI match:', protiMatch, protiMatch ? '' : `\n  DB: ${JSON.stringify(dbProti)}\n  PDF:${JSON.stringify(ep)}`);
  console.log('ZDRZAL match:', zdrzalMatch, zdrzalMatch ? '' : `\n  DB: ${JSON.stringify(dbZdrzal)}\n  PDF:${JSON.stringify(ez)}`);
}
check('hlasovanie č. 17', 'Uzn 20/2026 hlas.17 (DPMM Kollár)', pdf_h17_proti, pdf_h17_zdrzal);
check('30/2026', 'Uzn 30/2026 (zmena rozpoctu)', pdf_h23_proti, []);
