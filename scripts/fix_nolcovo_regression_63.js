// FIX WATCH #63 (2026-08-28): REGRESIA Obec Nolčovo — Krtko cez noc znova založil orphan entitu
// s CHYBNÝM IČO 00216822 (preklep 2<->3 verne skopírovaný zo zdrojového CRZ dokladu 12502992).
// To je opätovný výskyt presne toho, čo WATCH #59 (commit c4507ef) opravil 27.8 o 20:47 CEST;
// nová entita vznikla 27.8 o 18:48 UTC = 53 s PO tom commite (re-scrape čerstvej zmluvy 12502992,
// date_published 2026-08-27).
//
// Realita 2-zdrojovo:
//   Obec Nolčovo (okres Martin, Nolčovo 79, 03854) reálne IČO = 00316822
//     - RPO ŠÚ SR: identifier 00316822, "Obec Nolčovo", orgán verejnej moci od 1973-07-01 (exact).
//     - RÚZ registeruz #13203 + e-obce.sk + nolcovo.sk (z WATCH #59).
//   IČO 00216822 v RPO ŠÚ SR NEEXISTUJE (0 exact výsledkov) = preklep, chyba v CRZ zdroji.
//   CRZ 12502992: Objednávateľ Turčianska vodárenská spol. a.s. (36672084), Dodávateľ "Obec Nolčovo"
//     IČO 00216822 (chybné v samotnom doklade), "Zmluva o propagácii a reklame", 200 €.
//
// STRATÉGIA: keyed na IČO (nie na hardcoded UUID ako #59) — prežije aj ďalšie regresie s novým UUID.
//   CIEĽ = entita s ico 00316822 (správne). ZDROJ = entita s ico 00216822 (chybné).
//   Presunúť VŠETKY tx zdroja (supplier aj buyer) na cieľ, potom zmazať prázdny orphan.
//
// Poistka menovaných osôb SA NEUPLATŇUJE (obec = verejná inštitúcia, nie fyz. osoba; len zjednotenie
//   nesprávneho párovania na reálne IČO, žiadne nové obvinenie).
// Idempotentný: dry-run bez --apply; re-run po apply = SKIP (zdroj s ico 00216822 už neexistuje).
// Usage: node scripts/fix_nolcovo_regression_63.js [--apply]
require('dotenv').config({ path: '.env.local' });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const APPLY = process.argv.includes('--apply');
const TARGET_ICO = '00316822'; // správne IČO obce Nolčovo (RPO overené)
const WRONG_ICO = '00216822';  // chybné IČO (v RPO neexistuje)

(async () => {
  // CIEĽ: presne jedna entita s TARGET_ICO, názov Nolčovo
  const { data: tgt } = await supabase.from('entities').select('*').eq('ico', TARGET_ICO);
  if (!tgt || tgt.length !== 1 || !/nol.ovo/i.test(tgt[0].name)) {
    console.log('GUARD FAIL: cieľová entita 00316822 nie je jednoznačná/Nolčovo. Ručne.', JSON.stringify(tgt));
    return;
  }
  const TARGET_ID = tgt[0].id;
  console.log(`CIEĽ OK: ${tgt[0].name} ico=${tgt[0].ico} id=${TARGET_ID}`);

  // ZDROJ: entity s WRONG_ICO (orphan regresia)
  const { data: srcs } = await supabase.from('entities').select('*').eq('ico', WRONG_ICO);
  if (!srcs || srcs.length === 0) {
    console.log(`SKIP: žiadna entita s ico ${WRONG_ICO} (regresia už zlúčená = idempotentné).`);
  }
  let moved = 0, deleted = 0;
  for (const src of (srcs || [])) {
    // GUARD: zdroj musí byť Nolčovo (chránime pred zámenou iného subjektu)
    if (!/nol.ovo/i.test(src.name)) {
      console.log(`GUARD FAIL zdroj ${src.id}: name != Nolčovo (${src.name}). Preskakujem.`);
      continue;
    }
    console.log(`\nZDROJ: ${src.name} ico=${src.ico} id=${src.id} created_at=${src.created_at}`);
    const { data: asSup } = await supabase.from('transactions').select('id, external_id').eq('supplier_entity_id', src.id);
    const { data: asBuy } = await supabase.from('transactions').select('id, external_id').eq('buyer_entity_id', src.id);
    console.log(`  tx ako supplier: ${asSup.length} [${asSup.map(t=>t.external_id).join(', ')}]`);
    console.log(`  tx ako buyer:    ${asBuy.length} [${asBuy.map(t=>t.external_id).join(', ')}]`);

    if (APPLY) {
      for (const t of asSup) {
        const { error } = await supabase.from('transactions').update({ supplier_entity_id: TARGET_ID }).eq('id', t.id);
        if (error) console.log(`  ERR update sup ${t.external_id}: ${error.message}`); else moved++;
      }
      for (const t of asBuy) {
        const { error } = await supabase.from('transactions').update({ buyer_entity_id: TARGET_ID }).eq('id', t.id);
        if (error) console.log(`  ERR update buy ${t.external_id}: ${error.message}`); else moved++;
      }
      const { data: sup2 } = await supabase.from('transactions').select('id').eq('supplier_entity_id', src.id);
      const { data: buy2 } = await supabase.from('transactions').select('id').eq('buyer_entity_id', src.id);
      if (sup2.length === 0 && buy2.length === 0) {
        const { error } = await supabase.from('entities').delete().eq('id', src.id);
        if (error) console.log(`  ERR delete entity: ${error.message}`); else { console.log(`  DELETED orphan ${src.id}`); deleted++; }
      } else {
        console.log(`  NEDELETE: zdroj má stále tx (sup ${sup2.length}, buy ${buy2.length}).`);
      }
    } else {
      console.log('  [DRY-RUN] presunul by tx na CIEĽ a zmazal prázdnu orphan entitu.');
    }
  }
  console.log(`\n${APPLY ? 'APPLY' : 'DRY-RUN'} súhrn: moved=${moved}, deleted=${deleted}`);

  // finálny stav
  const { data: wrongLeft } = await supabase.from('entities').select('id').eq('ico', WRONG_ICO);
  const { data: fSup } = await supabase.from('transactions').select('external_id, amount_eur, subject').eq('supplier_entity_id', TARGET_ID);
  console.log(`\nPO OPRAVE: entít s ico ${WRONG_ICO} = ${wrongLeft ? wrongLeft.length : 0} (očak. 0)`);
  console.log(`CIEĽ ${TARGET_ICO} tx ako supplier: ${fSup.length}`);
  fSup.forEach(t => console.log('  ', t.external_id, t.amount_eur, t.subject));
})().catch(e => console.log('FATAL: ' + e.message));
