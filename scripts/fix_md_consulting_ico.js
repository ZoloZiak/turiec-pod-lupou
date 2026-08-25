// FIX (WATCH tik #21): entita IČO 35872799 "OMD Consulting, s. r. o." je NESPRAVNA.
// Realny dodavatel v CRZ zmluvach 9128681 + 10200534 (objednavatel Mesto Martin 00316792) je
// IČO 54179645 = "M&D CONSULTING s.r.o." (RPO SU SR, Banska Bystrica).
// DV-ICO-ALL (davka 80-119) omylom neopravil ZLE IČO, len premenoval nazov entity podla RPO
// lookupu toho zleho IČO -> vyrobil falosne tvrdenie ze dodavatel je bratislavska OMD Consulting.
// Toto je oprava FAKTU + REMOVE nepravdiveho priradenia. Firma (s.r.o.), poistka menovanych osob
// sa neuplatnuje. DEFAULT = dry-run. Spustenie s "--apply".
require('dotenv').config({ path: '.env.local' });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const APPLY = process.argv.includes('--apply');

const WRONG_ICO = '35872799';
const RIGHT_ICO = '54179645';
const RIGHT_NAME = 'M&D CONSULTING s.r.o.';

async function run() {
  console.log(`MODE: ${APPLY ? 'APPLY (zapisuje)' : 'DRY-RUN (nic sa nezapise)'}`);

  const { data: wrongEnts } = await supabase.from('entities').select('id, name, ico').eq('ico', WRONG_ICO);
  console.log(`\nZdrojove entity s ICO ${WRONG_ICO}: ${(wrongEnts || []).length}`);
  for (const e of (wrongEnts || [])) console.log(`  ${e.ico}  ${e.id}  "${e.name}"`);
  if (!wrongEnts || !wrongEnts.length) { console.log('Uz ziadna entita so zlym ICO -> pravdepodobne uz opravene (idempotentne).'); return; }

  const { data: rightEnts } = await supabase.from('entities').select('id, name, ico').eq('ico', RIGHT_ICO);
  console.log(`\nCielove entity so spravnym ICO ${RIGHT_ICO}: ${(rightEnts || []).length}`);
  for (const e of (rightEnts || [])) console.log(`  ${e.ico}  ${e.id}  "${e.name}"`);

  const wrongIds = wrongEnts.map(e => e.id);
  const { count: cBuy } = await supabase.from('transactions').select('id', {count:'exact', head:true}).in('buyer_entity_id', wrongIds);
  const { count: cSup } = await supabase.from('transactions').select('id', {count:'exact', head:true}).in('supplier_entity_id', wrongIds);
  console.log(`\nNa zle entity naviazane tx: buyer=${cBuy}, supplier=${cSup}`);

  if (!rightEnts || !rightEnts.length) {
    // RENUMBER: ziadna kolizia -> len oprav ICO + nazov na tej istej entite
    console.log(`\nPLAN: RENUMBER — ICO ${WRONG_ICO}->${RIGHT_ICO}, name -> "${RIGHT_NAME}" (entita ${wrongIds[0]})`);
    if (!APPLY) { console.log('\n[DRY-RUN] Nic sa nezmenilo. Spusti s --apply.'); return; }
    const { error } = await supabase.from('entities').update({ ico: RIGHT_ICO, name: RIGHT_NAME }).eq('id', wrongIds[0]);
    if (error) { console.log('ERR update: ' + error.message); return; }
    console.log('RENUMBER hotovy.');
  } else {
    // MERGE: cielova entita existuje -> premapuj tx a zmaz zle entity
    const TGT = rightEnts[0].id;
    console.log(`\nPLAN: MERGE — premapuj ${cBuy}+${cSup} tx na ${TGT}, zmaz zle entity`);
    if (!APPLY) { console.log('\n[DRY-RUN] Nic sa nezmenilo. Spusti s --apply.'); return; }
    const { error: e1 } = await supabase.from('transactions').update({ buyer_entity_id: TGT }).in('buyer_entity_id', wrongIds);
    if (e1) { console.log('ERR buyer: ' + e1.message); return; }
    const { error: e2 } = await supabase.from('transactions').update({ supplier_entity_id: TGT }).in('supplier_entity_id', wrongIds);
    if (e2) { console.log('ERR supplier: ' + e2.message); return; }
    const { count: rest } = await supabase.from('transactions').select('id', {count:'exact', head:true}).or(`buyer_entity_id.in.(${wrongIds.join(',')}),supplier_entity_id.in.(${wrongIds.join(',')})`);
    console.log(`Zostava na zlych entitach: ${rest}`);
    if ((rest || 0) === 0) {
      const { error: e3 } = await supabase.from('entities').delete().in('id', wrongIds);
      console.log(e3 ? ('ERR delete: ' + e3.message) : `Zmazane zle entity: ${wrongIds.length}`);
    }
    console.log('MERGE hotovy.');
  }

  // re-check
  const { data: after } = await supabase.from('entities').select('id, name, ico').eq('ico', RIGHT_ICO);
  console.log('\nPO OPRAVE entity so spravnym ICO:');
  for (const e of (after || [])) console.log(`  ${e.ico}  ${e.id}  "${e.name}"`);
  const { data: stillWrong } = await supabase.from('entities').select('id').eq('ico', WRONG_ICO);
  console.log(`Zostava entit so zlym ICO ${WRONG_ICO}: ${(stillWrong || []).length}`);
}
run().catch(e => console.log('FATAL: ' + e.message));
