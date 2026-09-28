// READ-ONLY WATCH #176: parse CRZ detail HTML (ulozene v /tmp) pre 5 dosiaľ NEoverených eu_funds
// riadkov (mimo #96 top-5 a #136 rotujúcich 5). Vytiahni sumy (Zmluvna/Celkova ciastka) + strany.
// Porovnaj s ocakavanou eu_funds sumou na cent. Ziadna DB/kod zmena.
const fs = require('fs');

const cases = [
  { file: '/tmp/eu_8029279.html',  expect: 826800.00, note: 'IROP-PO9-SC91-2023-108, Mesto Martin 00316792 <- MIRRI 50349287' },
  { file: '/tmp/eu_10782440.html', expect: 627404.07, note: 'Revitalizacia Parku P.O.Hviezdoslava, Mesto Martin 00316792 <- MIRRI 50349287' },
  { file: '/tmp/eu_12555943.html', expect: 619827.65, note: 'Energ. ucinnost ZS, Mesto Martin 00316792 <- MIRRI 50349287' },
  { file: '/tmp/eu_10952459.html', expect: 539715.52, note: 'Prestupovy terminal DPMM 53560922 <- MD SR 30416094' },
  { file: '/tmp/eu_9936715.html',  expect: 487225.70, note: 'Kyber. bezpecnost, Mesto Martin 00316792 <- MIRRI 50349287' },
];

function stripTags(s) { return s.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim(); }

function findAmounts(html) {
  const text = stripTags(html);
  const out = {};
  const labels = ['Zmluvne dohodnutá čiastka', 'Celková čiastka', 'Zmluvná cena', 'Hodnota'];
  for (const lab of labels) {
    const idx = text.indexOf(lab);
    if (idx >= 0) {
      const seg = text.slice(idx, idx + 120);
      const m = seg.match(/([\d\s]+[,.]\d{2})\s*(?:€|EUR|Eur)/);
      if (m) out[lab] = m[1].replace(/\s/g, '').replace(',', '.');
    }
  }
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

let okCount = 0;
for (const c of cases) {
  const html = fs.readFileSync(c.file, 'utf8');
  const size = html.length;
  const amts = findAmounts(html);
  const parties = findParties(html);
  const allE = amts._all_euro || [];
  const hit = allE.some(a => Math.abs(Number(a) - c.expect) < 0.005);
  if (hit) okCount++;
  console.log('=== ' + c.file + ' | expect ' + c.expect + ' | htmlBytes ' + size);
  console.log('  note:', c.note);
  console.log('  labelled:', JSON.stringify({ ...amts, _all_euro: undefined }));
  console.log('  all_euro:', allE.join(', ').slice(0, 220));
  console.log('  MATCH_ON_CENT:', hit ? 'YES' : 'NO');
  console.log('  nazov:', parties.nazov);
  console.log('  dodavatel:', parties.dodavatel);
  console.log('  objednavatel:', parties.objednavatel);
}
console.log('\nSUMMARY: ' + okCount + '/' + cases.length + ' MATCH_ON_CENT');
