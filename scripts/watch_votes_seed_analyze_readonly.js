// READ-ONLY: analyzuj database/06_council_votes_seed.sql BEZ DB.
// Vypis: pocet INSERT riadkov, distinct (vote_date||issue_title) = hlasovania,
// per-hlasovanie pocet poslancov + rozklad, globalny rozklad vote_cast,
// distinct mena poslancov, distinct source_url. Ziadny zapis, ziadna siet.
const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, '..', 'database', '06_council_votes_seed.sql');
const txt = fs.readFileSync(p, 'utf8');

// riadky s tuple: ('Meno', NULL, 'HLAS', 'Titul', 'YYYY-MM-DD', 'url'),
const re = /^\('((?:[^']|'')*)',\s*(NULL|'[^']*'),\s*'((?:[^']|'')*)',\s*'((?:[^']|'')*)',\s*'(\d{4}-\d{2}-\d{2})',\s*'((?:[^']|'')*)'\)/;
const lines = txt.split('\n');
let rows = [];
for (const ln of lines) {
  const m = ln.match(re);
  if (m) rows.push({ name: m[1], district: m[2], vote: m[3], title: m[4], date: m[5], url: m[6] });
}

const byVoting = new Map();
const globalVotes = {};
const names = new Set();
const urls = new Set();
const dates = new Set();
for (const r of rows) {
  const key = r.date + '||' + r.title;
  if (!byVoting.has(key)) byVoting.set(key, { date: r.date, title: r.title, counts: {}, n: 0, url: r.url });
  const v = byVoting.get(key);
  v.counts[r.vote] = (v.counts[r.vote] || 0) + 1;
  v.n++;
  globalVotes[r.vote] = (globalVotes[r.vote] || 0) + 1;
  names.add(r.name);
  urls.add(r.url);
  dates.add(r.date);
}

console.log('INSERT tuple rows:', rows.length);
console.log('distinct hlasovani (date||title):', byVoting.size);
console.log('distinct poslanci (mena):', names.size);
console.log('distinct datumy:', [...dates].sort().join(', '));
console.log('distinct source_url count:', urls.size);
console.log('GLOBAL rozklad:', JSON.stringify(globalVotes));
// hlasovania kde pocet poslancov != 31 (anomalia)
const bad = [...byVoting.values()].filter(v => v.n !== 31);
console.log('hlasovania s poctom != 31:', bad.length);
for (const b of bad.slice(0, 10)) console.log('  ', b.n, b.date, b.title.slice(0, 60));
// prvych par titulov + rozklad
console.log('--- vzorka hlasovani ---');
let i = 0;
for (const v of byVoting.values()) {
  if (i++ >= 6) break;
  console.log(v.date, '|', v.title.slice(0, 55), '|', JSON.stringify(v.counts));
}
// distinct urls
console.log('--- source_urls ---');
for (const u of urls) console.log('  ', u);

// per-den pocet hlasovani + zoznam cisel uzneseni (over ci parser nevynechal)
console.log('--- hlasovania na den + cisla uzneseni ---');
const perDay = new Map();
for (const v of byVoting.values()) {
  if (!perDay.has(v.date)) perDay.set(v.date, []);
  const m = v.title.match(/Uznesenie č\.\s*(\d+)\/2026/);
  perDay.get(v.date).push(m ? parseInt(m[1], 10) : ('?' + v.title.slice(0, 30)));
}
for (const [d, arr] of perDay) {
  const nums = arr.filter(x => typeof x === 'number').sort((a, b) => a - b);
  console.log(d, '| pocet hlasovani:', arr.length, '| cisla uzneseni:', nums.join(','));
}
