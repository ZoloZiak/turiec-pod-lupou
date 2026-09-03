// READ-ONLY: enumeruj entities s MALFORMOVANÝM reálnym IČO (nie NO_ICO_, nie čisté 8-cifr).
// Pre každý: tx count, sample source_url, návrh normalizácie, kolízia s existujúcim čistým IČO.
require('dotenv').config({ path: '.env.local' });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  // vsetky entities
  let ents = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb.from('entities').select('id,ico,name').range(from, from + PAGE - 1);
    if (error) { console.log('ERR entities: ' + error.message); process.exit(1); }
    ents = ents.concat(data);
    if (data.length < PAGE) break;
  }
  const cleanSet = new Set(ents.filter(e => /^\d{8}$/.test(String(e.ico || ''))).map(e => String(e.ico)));

  const malformed = ents.filter(e => {
    const ico = String(e.ico || '');
    if (!ico) return false;
    if (ico.startsWith('NO_ICO_')) return false;
    if (/^\d{8}$/.test(ico)) return false;
    return true; // ma nieco co nie je cisty 8-cifr ani NO_ICO_
  });

  const out = [];
  for (const e of malformed) {
    const ico = String(e.ico);
    // navrh normalizacie: odstran whitespace
    const stripped = ico.replace(/\s+/g, '');
    let category, proposal = null;
    if (/^\d{8}$/.test(stripped) && stripped !== ico) { category = 'WHITESPACE'; proposal = stripped; }
    else if (/^\d{6}$/.test(ico)) { category = 'SHORT6'; proposal = '00' + ico; }
    else if (/^\d{7}$/.test(ico)) { category = 'SHORT7'; proposal = '0' + ico; }
    else if (/^\d{9,}$/.test(ico)) { category = 'LONG9'; proposal = null; }
    else if (/,/.test(ico)) { category = 'MULTI'; proposal = null; }
    else if (/^\d{8}$/.test(stripped)) { category = 'WHITESPACE'; proposal = stripped; }
    else { category = 'OTHER'; proposal = null; }

    // kolizia: existuje uz cista entita s proposal IČO?
    const collision = proposal ? cleanSet.has(proposal) : null;

    // tx count
    let txc = 0, sampleUrl = null;
    for (let from = 0; ; from += 1000) {
      const { data: txs } = await sb.from('transactions').select('id,source_url').eq('entity_id', e.id).range(from, from + 999);
      if (!txs || !txs.length) break;
      txc += txs.length;
      if (!sampleUrl && txs[0].source_url) sampleUrl = txs[0].source_url;
      if (txs.length < 1000) break;
    }
    out.push({ id: e.id, ico, name: e.name, category, proposal, collision, tx_count: txc, sample_url: sampleUrl });
  }

  out.sort((a, b) => b.tx_count - a.tx_count);
  fs.writeFileSync('.audit/WATCH_ico_malformed_result.json', JSON.stringify(out, null, 2));
  const byCat = {};
  for (const r of out) byCat[r.category] = (byCat[r.category] || 0) + 1;
  console.log('MALFORMED entities: ' + out.length + ' | byCat: ' + JSON.stringify(byCat));
  console.log('with tx>0: ' + out.filter(r => r.tx_count > 0).length);
  console.log('');
  for (const r of out) {
    console.log(`${r.category}\t tx=${r.tx_count}\t coll=${r.collision}\t "${r.ico}" -> ${r.proposal || '?'} | ${r.name}`);
  }
})();
