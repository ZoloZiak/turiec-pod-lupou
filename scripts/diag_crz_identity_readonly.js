// READ-ONLY: stiahne CRZ detaily pre podozrivé kontrakty a vyparsuje IČO + názvy účastníkov
const CONTRACTS = [
  ['10734180 KATSUDO', 7951850],
  ['15030865 SOR', 8871356],
  ['15547591 HUBER', 9223750],
  ['27427889 IBOS', 12583527],
  ['31385915 SLOVNAFT', 10638877],
  ['31386563 UNEMOCNICA', 9801938],
  ['22664980 SLOVES', 11918267],
  ['30794536 UPSVAR', 9187365],
];
(async () => {
  for (const [label, id] of CONTRACTS) {
    try {
      const res = await fetch(`https://crz.gov.sk/zmluva/${id}/`, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(20000) });
      const html = await res.text();
      const text = html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
      const icos = [...text.matchAll(/(?:IČO|I\u010cO)\s*[:.]?\s*(\d{2}\s?\d{3}\s?\d{3})/gi)].map(m => m[1]);
      const idx = text.indexOf('Dodávateľ');
      console.log(`=== ${label} (${id}) HTTP ${res.status}`);
      console.log('ICO najdene:', [...new Set(icos)].join(' | ') || 'žiadne');
      if (idx > -1) console.log('Dodavatel blok:', text.slice(idx, idx + 300));
    } catch (e) { console.log(`=== ${label} (${id}) CHYBA ${e.message}`); }
    await new Promise(r => setTimeout(r, 800));
  }
})();
