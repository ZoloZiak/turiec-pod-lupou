// READ-ONLY: extrakcia účastníkov z CRZ HTML
const fs = require('fs');
for (const f of ['crz_poh', 'crz_dopstav', 'crz_goldy']) {
  const h = fs.readFileSync(`/tmp/${f}.html`, 'utf8');
  const txt = h.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ');
  const icoHits = [...txt.matchAll(/IČO[:\s]*(\d{7,8})/gi)].map(m => m[1]);
  const idx = [];
  for (const name of ['POH', 'Trapez', 'DOPSTAV', 'ARCOS', 'GOLDY']) {
    let i = txt.indexOf(name);
    if (i >= 0) idx.push(`${name}@${i}: …${txt.slice(Math.max(0, i - 60), i + 120).replace(/\s+/g, ' ')}…`);
  }
  console.log(`=== ${f}: ICO hits: ${[...new Set(icoHits)].join(',') || '-'} | size=${h.length}`);
  for (const s of idx) console.log('  ', s);
}
