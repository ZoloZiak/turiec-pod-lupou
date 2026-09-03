// READ-ONLY WATCH #93: filter RPO name-search /tmp/rpo_rra_name.json na presné/prefix
// zhody "RRA" (substring matchuje TERRA, TERRAM...). Vypíš kandidátov s IČO+adresou.
const fs = require('fs');
const d = JSON.parse(fs.readFileSync('/tmp/rpo_rra_name.json', 'utf8'));
const out = [];
for (const r of d.results || []) {
  const names = (r.fullNames || []).map(n => n.value);
  const ico = (r.identifiers || [])[0] && r.identifiers[0].value;
  // aktuálny (posledný) názov
  const current = names[names.length - 1] || '';
  const cu = current.toUpperCase();
  // prefix RRA (nie TERRA/SIERRA), tolerancia medzier/interpunkcie
  if (/^RRA\b/.test(cu) || cu.startsWith('RRA,') || cu.startsWith('RRA ') || cu.startsWith('R.R.A')) {
    const addr = (r.addresses || []).find(a => !a.validTo) || (r.addresses || [])[0] || {};
    out.push({ ico, current, all: names, muni: (addr.municipality || {}).value, street: addr.street, bn: addr.buildingNumber });
  }
}
console.log('RRA-prefix kandidáti: ' + out.length + ' z ' + (d.results || []).length + ' výsledkov');
for (const o of out) {
  console.log(`  IČO ${o.ico} | "${o.current}" | ${o.muni || '?'} ${o.street || ''} ${o.bn || ''}`);
  if (o.all.length > 1) console.log(`      histNázvy: ${JSON.stringify(o.all)}`);
}
