// READ-ONLY: individualne hlasy DB pre Uznesenie 44/2026 vs H.E.R. PDF (hlasovanie c.20, 26.03.2026, PROTI:2)
const fs = require('fs');
const j = JSON.parse(fs.readFileSync('/tmp/prod_votes.json', 'utf8'));

// PDF hl.20 (Uznesenie 44/2026), riadky 482-512 /tmp/vote_2603.pdf (ground truth)
const PDF = {
  'Tibor Adamko':'ZA','Marcela Amchová':'NEPRÍTOMNÝ','Martina Antošová':'NEPRÍTOMNÝ',
  'Zuzana Badová':'ZA','Marcela Balošáková':'ZA','Marek Belák':'ZA','Tatiana Červeňová':'NEHLASOVAL',
  'Milan Ftorek':'PROTI','Róbert Gajdoš':'NEPRÍTOMNÝ','Veronika Gajdošová Ladňáková':'NEPRÍTOMNÝ',
  'Marína Gallová':'NEPRÍTOMNÝ','Filip Horanský':'ZA','Bruno Horecký':'ZA','Lucia Hrivnák Klocová':'ZA',
  'Martin Hudec':'ZA','Tomáš Ignačák':'ZA','Jozef Krištoffy':'ZA','Martin Lechan':'ZA',
  'Martin Lepej':'PROTI','Juraj Marček':'ZDRŽAL SA','Michal Matejička':'ZA','Jozef Petráš':'NEPRÍTOMNÝ',
  'Andrej Rodák':'ZA','Juraj Stahl':'ZA','Stanislav Thomka':'ZA','Peter Török':'ZA',
  'Michal Uherčík':'ZA','Ľubomír Vaňko':'NEPRÍTOMNÝ','Tomáš Zanovit':'ZA',
  'Dana Žigová':'ZA','Adam Žilák':'ZA'
};

const dbRows = j.rows.filter(r => r.vote_date === '2026-03-26' && /Uznesenie č\. 44\/2026/.test(r.issue_title));
console.log('DB rows for Uznesenie 44/2026:', dbRows.length);
const db = {};
for (const r of dbRows) db[r.councillor_name] = r.vote_cast;

let match = 0, mismatch = 0, missing = 0;
for (const [name, pdfVote] of Object.entries(PDF)) {
  const dbVote = db[name];
  if (dbVote === undefined) { console.log('MISSING in DB:', name, '(PDF:', pdfVote + ')'); missing++; }
  else if (dbVote === pdfVote) match++;
  else { console.log('MISMATCH:', name, '| DB:', dbVote, '| PDF:', pdfVote); mismatch++; }
}
for (const name of Object.keys(db)) if (!(name in PDF)) console.log('DB EXTRA:', name, db[name]);
// zvlast over PROTI hlasy (najcitlivejsie)
const dbProti = Object.entries(db).filter(([,v]) => v === 'PROTI').map(([n]) => n).sort();
console.log('DB PROTI:', dbProti, '| PDF PROTI: [Milan Ftorek, Martin Lepej]');
console.log('\nSUMMARY: match=' + match, 'mismatch=' + mismatch, 'missing=' + missing, '/ 31');
