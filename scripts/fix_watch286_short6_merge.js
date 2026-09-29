// WATCH #286 FIX (dry-run default, --apply na zápis): MERGE 4 short6 orphan entít -> kanon 8-cifr.
// PROBLÉM: nový DPM/egov CORA scraper (dataset 315->839 IČO) uložil dodávateľov so short6 IČO
//   surovo (validácia /^\d{6,8}$/ prijme 6-cifr, correctIco ich nepokrýva) -> vznikli ORPHAN
//   entity čo rozštiepia profil dodávateľa na webe (napr. KOOPERATIVA 50 z 80 tx).
// 2-ZDROJOVO OVERENÉ (WATCH286_pairs_2src.json + merge_plan.json):
//   585441->00585441 KOOPERATIVA (RÚZ+RPO), 316792->00316792 Mesto Martin (RPO exact+RÚZ),
//   685852->00685852 Messer Tatragas (RÚZ+RPO), 151653->00151653 Slov. sporiteľňa (RÚZ).
//   Všetky 4: external_id PREKRYV=0 -> žiadne duplicity, kanon entita v DB existuje.
// FIX (vzor fix_nolcovo_ico_merge.js): presuň tx orphan->kanon, over 0 zvyšku, zmaž orphan.
// POISTKA MENOVANÝCH OSÔB: neuplatňuje sa (firmy/mesto = inštitúcie, nie fyz. osoby; len oprava
//   párovania na reálne IČO, žiadne nové obvinenie). Idempotentné (keyed na IČO, guard na názov).
require('dotenv').config({ path: '.env.local' });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const APPLY = process.argv.includes('--apply');

// wrong IČO (orphan) -> good IČO (kanon) | guard fragment názvu (musí byť v oboch menách)
const PAIRS = [
  { wrong: '585441', good: '00585441', guard: 'KOOPERATIVA' },
  { wrong: '316792', good: '00316792', guard: 'Mesto Martin' },
  { wrong: '685852', good: '00685852', guard: 'Tatragas' },
  { wrong: '151653', good: '00151653', guard: 'sporiteľňa' },
];

async function ent(ico) {
  const { data, error } = await sb.from('entities').select('id,ico,name').eq('ico', ico);
  if (error) throw new Error('ent ' + ico + ': ' + error.message);
  return data || [];
}
async function txIds(field, id) {
  const { data, error } = await sb.from('transactions').select('id').eq(field, id);
  if (error) throw new Error(field + ': ' + error.message);
  return (data || []).map(r => r.id);
}

(async () => {
  console.log(`=== WATCH #286 MERGE 4 short6 orphan (${APPLY ? 'APPLY' : 'DRY-RUN'}) ===\n`);
  let done = 0, skipped = 0;
  for (const p of PAIRS) {
    const orphans = await ent(p.wrong);
    const canons = await ent(p.good);
    // idempotencia: orphan už zmazaný -> NO-OP
    if (orphans.length === 0) { console.log(`NO-OP ${p.wrong}->${p.good}: orphan neexistuje (merge už prebehol).`); skipped++; continue; }
    if (canons.length !== 1) { console.log(`ABORT ${p.wrong}->${p.good}: kanon entít=${canons.length} (očakával 1).`); skipped++; continue; }
    if (orphans.length !== 1) { console.log(`ABORT ${p.wrong}->${p.good}: orphan entít=${orphans.length} (očakával 1).`); skipped++; continue; }
    const src = orphans[0], tgt = canons[0];
    // guard: obe mená musia obsahovať fragment
    if (!(src.name || '').includes(p.guard) || !(tgt.name || '').includes(p.guard)) {
      console.log(`ABORT ${p.wrong}->${p.good}: guard "${p.guard}" nesedí (src="${src.name}", tgt="${tgt.name}").`); skipped++; continue;
    }
    const supIds = await txIds('supplier_entity_id', src.id);
    const buyIds = await txIds('buyer_entity_id', src.id);
    console.log(`${p.wrong}->${p.good} (${p.guard}): orphan ${src.id} tx sup=${supIds.length} buy=${buyIds.length} -> kanon ${tgt.id}`);
    if (!APPLY) { console.log(`  DRY-RUN: presunul by som ${supIds.length + buyIds.length} tx a zmazal orphan.`); continue; }
    if (supIds.length) {
      const { error } = await sb.from('transactions').update({ supplier_entity_id: tgt.id }).eq('supplier_entity_id', src.id);
      if (error) throw new Error('update supplier ' + p.wrong + ': ' + error.message);
    }
    if (buyIds.length) {
      const { error } = await sb.from('transactions').update({ buyer_entity_id: tgt.id }).eq('buyer_entity_id', src.id);
      if (error) throw new Error('update buyer ' + p.wrong + ': ' + error.message);
    }
    // data-loss guard: over že na orphan nič neostalo
    const supLeft = await txIds('supplier_entity_id', src.id);
    const buyLeft = await txIds('buyer_entity_id', src.id);
    if (supLeft.length || buyLeft.length) { console.log(`  ABORT pred delete: na orphan ostalo sup=${supLeft.length} buy=${buyLeft.length}!`); skipped++; continue; }
    const { error: delErr } = await sb.from('entities').delete().eq('id', src.id);
    if (delErr) throw new Error('delete ' + p.wrong + ': ' + delErr.message);
    console.log(`  ✅ presunutých ${supIds.length + buyIds.length} tx, orphan ${src.id} zmazaný.`);
    done++;
  }
  console.log(`\n=== HOTOVO: ${APPLY ? 'aplikovaných' : 'na aplikovanie'} ${APPLY ? done : PAIRS.length - skipped} merge, ${skipped} skip/no-op ===`);
})().catch(e => console.log('FATAL: ' + e.message));
