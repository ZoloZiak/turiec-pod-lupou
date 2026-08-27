// FIX WATCH #59: zjednotenie 3 fragmentov "Obec Nolčovo" na JEDNU entitu s REÁLNYM IČO 00316822.
//
// Reálne IČO obce Nolčovo (okres Martin, Nolčovo 79) = 00316822 — overené 5 zdrojmi:
//   RPO ŠÚ SR fulltext exact, RÚZ registeruz #13203, e-obce.sk, finstat.sk/00316822, nolcovo.sk.
//   IČO 00216822 v RPO NEEXISTUJE (0 výsledkov) = preklep 2<->3, ktorý Krtko skopíroval z chybného
//   CRZ dokladu 12502992 a založil novú entitu 24.8 (nočná regresia).
//
// CIEĽ = fd5a0373 (ico 00316822, správne). ZDROJE presunúť + zmazať:
//   4f39df1b (ico 00216822, CHYBNÉ, 1 tx crz_12502992)
//   3bd302cb (NO_ICO_OBECNOLOVO, 2 tx crz_9459641 + crz_10882875; oba CRZ doklady majú 00316822)
//
// Všetky 3 tx: Dodávateľ Obec Nolčovo -> Objednávateľ Turčianska vodárenská spol. 36672084,
//   "Zmluva o propagácii a reklame", 200 €. Tá istá obec.
//
// Poistka menovaných osôb SA NEUPLATŇUJE (obec = verejná inštitúcia, nie fyz. osoba; len zjednotenie
//   nesprávneho párovania na reálne IČO, žiadne nové obvinenie).
// Idempotentný: dry-run bez --apply; re-run po apply = SKIP (zdroje už neexistujú).
// Usage: node scripts/fix_nolcovo_merge.js [--apply]
require('dotenv').config({ path: '.env.local' });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const APPLY = process.argv.includes('--apply');
const TARGET_ID = 'fd5a0373-91fa-45cf-a921-a8efb7f3efa5';
const TARGET_ICO = '00316822';
const SOURCES = ['4f39df1b-ce38-4770-896a-d43fd11ac86a', '3bd302cb-6ae3-4160-98e0-b072d320dec4'];

(async () => {
  // GUARD 1: cieľová entita existuje, správne IČO, názov Nolčovo
  const { data: tgt } = await supabase.from('entities').select('*').eq('id', TARGET_ID);
  if (!tgt || tgt.length !== 1 || tgt[0].ico !== TARGET_ICO || !/nol.ovo/i.test(tgt[0].name)) {
    console.log('GUARD FAIL: cieľová entita nezodpovedá (ico/name). Zisti stav ručne.', JSON.stringify(tgt));
    return;
  }
  console.log(`CIEĽ OK: ${tgt[0].name} ico=${tgt[0].ico} id=${TARGET_ID}`);

  let moved = 0, deleted = 0, skipped = 0;
  for (const srcId of SOURCES) {
    const { data: src } = await supabase.from('entities').select('*').eq('id', srcId);
    if (!src || src.length === 0) { console.log(`SKIP zdroj ${srcId} (neexistuje = už zlúčené).`); skipped++; continue; }
    // GUARD 2: zdroj musí byť Nolčovo
    if (!/nol.ovo/i.test(src[0].name)) { console.log(`GUARD FAIL zdroj ${srcId}: name != Nolčovo (${src[0].name}). Preskakujem.`); continue; }
    console.log(`\nZDROJ: ${src[0].name} ico=${src[0].ico} id=${srcId}`);

    const { data: asSup } = await supabase.from('transactions').select('id, external_id').eq('supplier_entity_id', srcId);
    const { data: asBuy } = await supabase.from('transactions').select('id, external_id').eq('buyer_entity_id', srcId);
    console.log(`  tx ako supplier: ${asSup.length} [${asSup.map(t=>t.external_id).join(', ')}]`);
    console.log(`  tx ako buyer:    ${asBuy.length} [${asBuy.map(t=>t.external_id).join(', ')}]`);

    if (APPLY) {
      for (const t of asSup) {
        const { error } = await supabase.from('transactions').update({ supplier_entity_id: TARGET_ID }).eq('id', t.id);
        if (error) { console.log(`  ERR update sup ${t.external_id}: ${error.message}`); } else { moved++; }
      }
      for (const t of asBuy) {
        const { error } = await supabase.from('transactions').update({ buyer_entity_id: TARGET_ID }).eq('id', t.id);
        if (error) { console.log(`  ERR update buy ${t.external_id}: ${error.message}`); } else { moved++; }
      }
      // re-check že zdroj už nemá tx, potom delete
      const { data: sup2 } = await supabase.from('transactions').select('id').eq('supplier_entity_id', srcId);
      const { data: buy2 } = await supabase.from('transactions').select('id').eq('buyer_entity_id', srcId);
      if (sup2.length === 0 && buy2.length === 0) {
        const { error } = await supabase.from('entities').delete().eq('id', srcId);
        if (error) { console.log(`  ERR delete entity: ${error.message}`); } else { console.log(`  DELETED prázdna zdrojová entita ${srcId}`); deleted++; }
      } else {
        console.log(`  NEDELETE: zdroj má stále tx (sup ${sup2.length}, buy ${buy2.length}).`);
      }
    } else {
      console.log('  [DRY-RUN] presunul by tx na CIEĽ a zmazal prázdnu zdrojovú entitu.');
    }
  }
  console.log(`\n${APPLY ? 'APPLY' : 'DRY-RUN'} súhrn: moved=${moved}, deleted=${deleted}, skipped=${skipped}`);

  // finálny stav cieľa
  const { data: fSup } = await supabase.from('transactions').select('external_id, amount_eur, subject').eq('supplier_entity_id', TARGET_ID);
  console.log(`\nCIEĽ ${TARGET_ICO} teraz tx ako supplier: ${fSup.length}`);
  fSup.forEach(t => console.log('  ', t.external_id, t.amount_eur, t.subject));
})().catch(e => console.log('FATAL: ' + e.message));
