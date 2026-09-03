// READ+WRITE (len .audit/ JSON, NIE DB) WATCH #81: zosúladenie watch_ico_live_set.json s realitou.
// Pridá 3 RPO-overené čisté IČO (opravy #53/#54 + prírastok #70), odstráni 2 staré chybné
// (nahradené opravami). Idempotentné: druhý beh = 0 zmien.
const fs = require('fs');
const SETPATH = '.audit/watch_ico_live_set.json';
const ADD = [
  { ico: '46570870', name: 'ARCHEOVÝSKUM s.r.o.' },      // RPO exact, Obchodný register, oprava #53
  { ico: '56250673', name: 'PT Slovakia Group s. r. o.' }, // RPO exact, Obchodný register, oprava #54
  { ico: '54972116', name: 'Skymat s.r.o.' },             // RPO exact, Obchodný register, prírastok #70
];
const REMOVE = new Set(['51690551', '52219763']); // staré chybné IČO, nahradené vyššie

const set = JSON.parse(fs.readFileSync(SETPATH, 'utf8'));
const byIco = new Map(set.items.map(i => [String(i.ico), i]));
let removed = 0, added = 0;
for (const r of REMOVE) if (byIco.delete(r)) removed++;
for (const a of ADD) if (!byIco.has(a.ico)) { byIco.set(a.ico, a); added++; }

const items = [...byIco.values()].sort((x, y) => String(x.ico).localeCompare(String(y.ico)));
set.items = items;
set.distinctIco = items.length;
set.reconciled = '2026-08-29 WATCH #81 (3 RPO-overené IČO pridané, 2 staré chybné odstránené)';
fs.writeFileSync(SETPATH, JSON.stringify(set, null, 1));
console.log(`reconcile: removed=${removed} added=${added} total=${items.length}`);
