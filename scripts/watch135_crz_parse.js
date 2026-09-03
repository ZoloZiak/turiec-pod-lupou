// READ-ONLY WATCH #135: parse CRZ detail HTML (ulozene v /tmp) - vytiahni sumy (Zmluvna/Celkova ciastka)
// + strany (Dodavatel/Objednavatel). Porovnaj s ocakavanou eu_funds sumou.
const fs = require('fs');

const cases = [
  { file: '/tmp/eu_11222637.html', expect: 873989.65, note: 'Modernizacia ZS Aurela Stodolu, Mesto Martin' },
  { file: '/tmp/eu_11439149.html', expect: 659602.53, note: 'NFP MZP-PSK-401202G206, TVS' },
  { file: '/tmp/eu_7639383.html',  expect: 514386.36, note: 'Interreg SK-CZ Z SKCZ304021CKS7, Mesto Martin' },
  { file: '/tmp/eu_12499761.html', expect: 372537.88, note: 'NFP Dopravny podnik mesta Martin' },
  { file: '/tmp/eu_9128832.html',  expect: 169030.99, note: 'MOPS 401406DUN6, Mesto Martin' },
];

function stripTags(s) { return s.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim(); }

function findAmounts(html) {
  const text = stripTags(html);
  const out = {};
  // Look for labels then following euro amount
  const labels = ['Zmluvne dohodnutá čiastka', 'Celková čiastka', 'Zmluvná cena', 'Hodnota'];
  for (const lab of labels) {
    const idx = text.indexOf(lab);
    if (idx >= 0) {
      const seg = text.slice(idx, idx + 120);
      const m = seg.match(/([\d\s]+[,.]\d{2})\s*(?:€|EUR|Eur)/);
      if (m) out[lab] = m[1].replace(/\s/g, '').replace(',', '.');
    }
  }
  // fallback: all euro amounts
  const all = [];
  const re = /([\d][\d\s]*[,.]\d{2})\s*(?:€|EUR)/g; let mm;
  while ((mm = re.exec(text)) !== null) all.push(mm[1].replace(/\s/g, '').replace(',', '.'));
  out._all_euro = [...new Set(all)];
  return out;
}

function findParties(html) {
  const text = stripTags(html);
  const grab = (lab) => {
    const idx = text.indexOf(lab);
    if (idx < 0) return null;
    return text.slice(idx, idx + 160).replace(lab, '').trim().slice(0, 90);
  };
  return {
    dodavatel: grab('Dodávateľ'),
    objednavatel: grab('Objednávateľ'),
    nazov: grab('Názov'),
  };
}

for (const c of cases) {
  const html = fs.readFileSync(c.file, 'utf8');
  const amts = findAmounts(html);
  const parties = findParties(html);
  const allE = amts._all_euro || [];
  const hit = allE.some(a => Math.abs(Number(a) - c.expect) < 0.005);
  console.log('=== ' + c.file + ' | expect ' + c.expect + ' | ' + c.note);
  console.log('  labelled:', JSON.stringify({ ...amts, _all_euro: undefined }));
  console.log('  all_euro:', allE.join(', ').slice(0, 200));
  console.log('  MATCH_ON_CENT:', hit ? 'YES' : 'NO');
  console.log('  nazov:', parties.nazov);
  console.log('  dodavatel:', parties.dodavatel);
  console.log('  objednavatel:', parties.objednavatel);
}
