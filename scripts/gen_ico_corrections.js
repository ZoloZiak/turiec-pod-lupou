// Generátor presného TS bloku ICO_CORRECTIONS z WATCH89 overených dát (byte-presné whitespace kľúče).
const fs = require('fs');
const R = JSON.parse(fs.readFileSync('.audit/WATCH89_malformed_reality.json', 'utf8'));

// Reálne IČO (2-zdrojovo overené: CRZ dodávateľský detail + RPO exact názov).
const REAL = {
  'VS Guard, s.r.o.': '31580726',
  'DFM Slovakia s.r.o.': '55049249',
  'MAJES výťahy a eskalátory, a.s.': '35770732',
  'KV - mont Martin, s.r.o.': '44552483',
  'Obec Rudno': '00316873',
  'SIRS - Development, a.s.': '36751804',
  'Stavchem s.r.o.': '36368792',
  'Obec Brieštie': '00316580',
  'Obec Turčianske Jaseno': '00316679',
  'BTI s.r.o.': '47619503',
  'eSYST s.r.o.': '50139088',
  'Generali Poisťovňa, a.s.': '35709332',
};
// Neopraviteľné (CRZ neuvádza dod IČO / strip vedie na cudzí subjekt / MULTI): SKIP, guard drží.
const SKIP = new Set(['EUROPOWER, s.r.o', 'RRA, a.s.',
  'Základná organizácia SLOVES pri mestskom úrade Martin, Základná organizácia pri mestskej polícií v Martine']);

const lines = [];
for (const r of R) {
  if (SKIP.has(r.name)) continue;
  const real = REAL[r.name];
  if (!real) { console.error('CHÝBA REAL pre: ' + r.name); continue; }
  // exact kľúč = presný DB string (vrátane medzier), hodnota = overené reálne IČO
  lines.push(`  ${JSON.stringify(r.ico)}: '${real}', // ${r.name}`);
}
fs.writeFileSync('/tmp/ico_corr_block.txt', lines.join('\n'));
console.log('Vygenerovaných ' + lines.length + ' korekcií:');
console.log(lines.join('\n'));
