// READ-ONLY: individualne hlasy DB pre Uznesenie 32/2026 vs oficialny H.E.R. PDF (hlasovanie c.3, 26.03.2026)
const fs = require('fs');
const j = JSON.parse(fs.readFileSync('/tmp/prod_votes.json', 'utf8'));

// PDF c.3 (Uznesenie 32/2026) - prepis z /tmp/vote_2603.pdf riadky 6-36 (ground truth)
const PDF = {
  'Tibor Adamko':'ZA','Marcela Amchová':'NEPRÍTOMNÝ','Martina Antošová':'NEPRÍTOMNÝ',
  'Zuzana Badová':'NEHLASOVAL','Marcela Balošáková':'NEHLASOVAL','Marek Belák':'ZA',
  'Tatiana Červeňová':'NEHLASOVAL','Milan Ftorek':'ZA','Róbert Gajdoš':'NEPRÍTOMNÝ',
  'Veronika Gajdošová Ladňáková':'NEPRÍTOMNÝ','Marína Gallová':'NEPRÍTOMNÝ','Filip Horanský':'ZA',
  'Bruno Horecký':'ZA','Lucia Hrivnák Klocová':'NEHLASOVAL','Martin Hudec':'NEHLASOVAL',
  'Tomáš Ignačák':'NEPRÍTOMNÝ','Jozef Krištoffy':'NEHLASOVAL','Martin Lechan':'ZA',
  'Martin Lepej':'NEPRÍTOMNÝ','Juraj Marček':'ZA','Michal Matejička':'ZA','Jozef Petráš':'ZA',
  'Andrej Rodák':'ZA','Juraj Stahl':'ZA','Stanislav Thomka':'ZA','Peter Török':'ZA',
  'Michal Uherčík':'ZA','Ľubomír Vaňko':'NEPRÍTOMNÝ','Tomáš Zanovit':'ZA',
  'Dana Žigová':'ZA','Adam Žilák':'NEHLASOVAL'
};

const dbRows = j.rows.filter(r => r.vote_date === '2026-03-26' && /Uznesenie č\. 32\/2026/.test(r.issue_title));
console.log('DB rows for Uznesenie 32/2026:', dbRows.length);
const db = {};
for (const r of dbRows) db[r.councillor_name] = r.vote_cast;

let match = 0, mismatch = 0, missing = 0;
for (const [name, pdfVote] of Object.entries(PDF)) {
  const dbVote = db[name];
  if (dbVote === undefined) { console.log('MISSING in DB:', name, '(PDF:', pdfVote + ')'); missing++; }
  else if (dbVote === pdfVote) match++;
  else { console.log('MISMATCH:', name, '| DB:', dbVote, '| PDF:', pdfVote); mismatch++; }
}
// aj naopak: v DB navyse mena mimo PDF
for (const name of Object.keys(db)) if (!(name in PDF)) console.log('DB EXTRA (not in PDF):', name, db[name]);

console.log('\nSUMMARY: match=' + match, 'mismatch=' + mismatch, 'missing=' + missing, '/ 31');
