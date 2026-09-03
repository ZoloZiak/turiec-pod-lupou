// READ-ONLY: overenie identity IČO 35872799 (WATCH tik #21).
// DV-ICO-ALL premenoval DB entitu "M&D CONSULTING s.r.o." -> "OMD Consulting, s. r. o."
// s odovodnenim ze M&D bol preklep. RPO pre 35872799 vracia OMD Consulting (Bratislava).
// ALE nezavisly web ukazuje ze M&D CONSULTING s.r.o. realne existuje ako iny subjekt.
// Overujeme co REALNE stoji v CRZ zmluvach nasej DB pre toto IČO (3. zdroj = detail zmluvy).
require('dotenv').config({ path: '.env.local' });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: ents } = await supabase.from('entities').select('id, name, ico').eq('ico', '35872799');
  console.log('ENTITY s IČO 35872799 (' + (ents ? ents.length : 0) + '):');
  for (const en of (ents || [])) console.log(`  ico=${en.ico}  id=${en.id}  name="${en.name}"`);
  if (!ents || !ents.length) { console.log('ZIADNA entita s tymto IČO — mozno premapovane na ine.'); }

  const entIds = (ents || []).map(e => e.id);
  let txs = [];
  if (entIds.length) {
    const { data: asSup } = await supabase.from('transactions')
      .select('external_id, amount_eur, subject, source_url, buyer_entity_id, supplier_entity_id')
      .in('supplier_entity_id', entIds).range(0, 999);
    const { data: asBuy } = await supabase.from('transactions')
      .select('external_id, amount_eur, subject, source_url, buyer_entity_id, supplier_entity_id')
      .in('buyer_entity_id', entIds).range(0, 999);
    txs = [...(asSup || []), ...(asBuy || [])];
  }
  console.log(`\nTRANSAKCIE naviazane na IČO 35872799: ${txs.length}`);
  for (const t of txs) console.log(`  ${t.external_id} | ${t.amount_eur} EUR | ${t.source_url} | ${(t.subject || '').slice(0, 60)}`);

  // stiahni CRZ detail prvych par zmluv -> zisti realny nazov dodavatela + IČO v zmluve
  for (const t of txs.slice(0, 5)) {
    const m = (t.source_url || '').match(/zmluva\/(\d+)/);
    if (!m) { console.log(`\n[${t.external_id}] source_url nie je CRZ: ${t.source_url}`); continue; }
    try {
      const res = await fetch(`https://crz.gov.sk/zmluva/${m[1]}/`, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(20000) });
      const html = await res.text();
      const text = html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
      const icos = [...text.matchAll(/(?:IČO|I\u010cO)\s*[:.]?\s*(\d{2}\s?\d{3}\s?\d{3})/gi)].map(x => x[1].replace(/\s/g, ''));
      const idxD = text.indexOf('Dodávateľ');
      const idxO = text.indexOf('Objednávateľ');
      console.log(`\n=== CRZ ${m[1]} (${t.external_id}) HTTP ${res.status}`);
      console.log('  IČO v zmluve:', [...new Set(icos)].join(' | ') || 'ziadne');
      if (idxO > -1) console.log('  Objednavatel blok:', text.slice(idxO, idxO + 160));
      if (idxD > -1) console.log('  Dodavatel blok:', text.slice(idxD, idxD + 200));
    } catch (e) { console.log(`=== CRZ ${m[1]} CHYBA ${e.message}`); }
    await new Promise(r => setTimeout(r, 800));
  }
}
run().catch(e => console.log('FATAL: ' + e.message));
