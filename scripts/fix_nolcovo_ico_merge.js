// WATCH #253 FIX (dry-run default, --apply na zápis): MERGE duplicitnej entity Obec Nolčovo.
// PROBLÉM: Krtko cez noc (2026-09-10) vytvoril duplicitnú entitu "Obec Nolčovo" s CHYBNÝM IČO
//   00216822 (preklep zdroja CRZ O-67/2026), pričom v RPO/RÚZ/CRZ entity page je správne 00316822.
//   -> 2 entity rovnakého mena, zmluvy rozštiepené (1 vs 2), /dodavatel/00216822 = mŕtve register-linky.
// 2-ZDROJOVO OVERENÉ: RPO exact 00316822 -> "Obec Nolčovo" (validFrom 1973, OVM); 00216822 -> results:[]
//   (neexistuje). RÚZ 00316822 = Obec Nolčovo. CRZ entity 6274095-sk/obec-nolcovo = 00316822.
// FIX (vzor src/app/api/admin/merge/route.ts): presuň tx source->target, over kolíziu, zmaž source.
// POISTKA: Obec = OVM/inštitúcia (nie menovaná fyz. osoba) -> len oprava faktickej chyby IČO. Idempotentné.
require('dotenv').config({ path: '/Users/ziak.z/projects/turiec-pod-lupou/.env.local' });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const APPLY = process.argv.includes('--apply');
const SOURCE_ID = '1196e02c-92e4-48f0-a91a-5e9eeddb2603';  // ico 00216822 (chybné, mazať)
const TARGET_ID = 'fd5a0373-91fa-45cf-a921-a8efb7f3efa5';  // ico 00316822 (správne, ponechať)
const BAD_ICO = '00216822';
const GOOD_ICO = '00316822';

async function txIds(field, id) {
  const { data, error } = await sb.from('transactions').select('id').eq(field, id);
  if (error) throw new Error(field + ': ' + error.message);
  return (data || []).map(r => r.id);
}

(async () => {
  console.log(`=== MERGE Obec Nolčovo (${APPLY ? 'APPLY' : 'DRY-RUN'}) ===`);

  // sanity: over že source má chybné a target správne IČO (idempotencia — ak už zmazané, skonči)
  const { data: src } = await sb.from('entities').select('id, ico, name').eq('id', SOURCE_ID);
  const { data: tgt } = await sb.from('entities').select('id, ico, name').eq('id', TARGET_ID);
  if (!tgt || tgt.length === 0) { console.log('CIEĽOVÁ entita neexistuje — ABORT (bezpečnostná poistka).'); return; }
  if (tgt[0].ico !== GOOD_ICO) { console.log(`CIEĽ má neočakávané IČO ${tgt[0].ico} — ABORT.`); return; }
  if (!src || src.length === 0) { console.log('Zdrojová (chybná) entita už neexistuje — merge už prebehol, NO-OP (idempotentné).'); return; }
  if (src[0].ico !== BAD_ICO) { console.log(`ZDROJ má neočakávané IČO ${src[0].ico} — ABORT.`); return; }
  console.log('SOURCE:', JSON.stringify(src[0]));
  console.log('TARGET:', JSON.stringify(tgt[0]));

  const supIds = await txIds('supplier_entity_id', SOURCE_ID);
  const buyIds = await txIds('buyer_entity_id', SOURCE_ID);
  console.log(`Tx na presun: supplier_entity_id=${supIds.length} (${supIds.join(',')}), buyer_entity_id=${buyIds.length} (${buyIds.join(',')})`);

  if (!APPLY) {
    console.log('DRY-RUN: presunul by som ' + (supIds.length + buyIds.length) + ' tx z ' + SOURCE_ID + ' -> ' + TARGET_ID + ', potom zmazal zdrojovú entitu. Spusti s --apply.');
    return;
  }

  // 1) presun supplier tx
  if (supIds.length) {
    const { error } = await sb.from('transactions').update({ supplier_entity_id: TARGET_ID }).eq('supplier_entity_id', SOURCE_ID);
    if (error) throw new Error('update supplier: ' + error.message);
    console.log('Presunutých supplier tx: ' + supIds.length);
  }
  // 2) presun buyer tx
  if (buyIds.length) {
    const { error } = await sb.from('transactions').update({ buyer_entity_id: TARGET_ID }).eq('buyer_entity_id', SOURCE_ID);
    if (error) throw new Error('update buyer: ' + error.message);
    console.log('Presunutých buyer tx: ' + buyIds.length);
  }
  // 3) over že na source už nič nevisí PRED zmazaním (data-loss guard)
  const supLeft = await txIds('supplier_entity_id', SOURCE_ID);
  const buyLeft = await txIds('buyer_entity_id', SOURCE_ID);
  if (supLeft.length || buyLeft.length) { console.log(`ABORT pred delete: na zdroji ostalo sup=${supLeft.length} buy=${buyLeft.length} tx!`); return; }
  // 4) zmaž chybnú duplicitnú entitu
  const { error: delErr } = await sb.from('entities').delete().eq('id', SOURCE_ID);
  if (delErr) throw new Error('delete: ' + delErr.message);
  console.log('Zmazaná chybná entita ' + SOURCE_ID + ' (ico ' + BAD_ICO + ').');

  // 5) verifikácia po merge
  const { data: after } = await sb.from('entities').select('id, ico, name').ilike('name', '%Nolčovo%');
  console.log('PO MERGE entity %Nolčovo%:', JSON.stringify(after));
  const finalSup = await txIds('supplier_entity_id', TARGET_ID);
  console.log('Cieľová entita ' + GOOD_ICO + ' teraz supplier_tx=' + finalSup.length);
})().catch(e => console.log('FATAL: ' + e.message));
