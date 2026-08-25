// Rapavy Peter -> Turcianska vodarenska spolocnost, a.s. (premapovanie mis-atribucie entity resolvera).
// DEFAULT = dry-run (NIC nezapise). Spustenie s "--apply" vykona zmenu.
// Poistka menovanych osob: LEN odstranuje nepravdive priradenie sukromnej osobe (Peter Rapavy je
// podpisujuci statutar, NIE zmluvna strana). Nepridava ziadne nove obvinenie.
require('dotenv').config({ path: '.env.local' });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const APPLY = process.argv.includes('--apply');
const TVS_ID = '8fc07edb-4665-46ec-8619-bd628b15a503'; // Turcianska vodarenska spolocnost, a.s. (ICO 36672084)

async function run() {
  const { data: ents } = await supabase.from('entities').select('id, name, ico').ilike('name', '%Rapav%');
  const entIds = ents.map(e => e.id);
  console.log(`MODE: ${APPLY ? 'APPLY (zapisuje)' : 'DRY-RUN (nic sa nezapise)'}`);
  console.log(`Zdrojove entity (Rapavy Peter): ${entIds.length}`);
  for (const e of ents) console.log(`  ${e.ico}  ${e.id}`);

  // over ze cielova entita existuje
  const { data: tgt } = await supabase.from('entities').select('id, name, ico').eq('id', TVS_ID).single();
  if (!tgt) { console.log('CHYBA: cielova entita neexistuje!'); return; }
  console.log(`Ciel: "${tgt.name}" ICO ${tgt.ico} (${tgt.id})`);

  const { count: cBuy } = await supabase.from('transactions').select('id',{count:'exact',head:true}).in('buyer_entity_id', entIds);
  const { count: cSup } = await supabase.from('transactions').select('id',{count:'exact',head:true}).in('supplier_entity_id', entIds);
  console.log(`\nPremapuje sa: buyer_entity_id ${cBuy} tx, supplier_entity_id ${cSup} tx`);

  if (!APPLY) {
    console.log('\n[DRY-RUN] Nic sa nezmenilo. Pre vykonanie spusti s --apply.');
    return;
  }

  // APPLY: premapuj buyer a supplier na TVS, potom zmaz prazdne Rapavy entity
  const { error: e1, count: u1 } = await supabase.from('transactions').update({ buyer_entity_id: TVS_ID }, {count:'exact'}).in('buyer_entity_id', entIds);
  if (e1) { console.log('ERR buyer update: '+e1.message); return; }
  const { error: e2, count: u2 } = await supabase.from('transactions').update({ supplier_entity_id: TVS_ID }, {count:'exact'}).in('supplier_entity_id', entIds);
  if (e2) { console.log('ERR supplier update: '+e2.message); return; }
  console.log(`Premapovanych: buyer ${u1}, supplier ${u2}`);

  // over ze uz na Rapavy nic nevisi, potom zmaz duplicitne entity
  const { count: rest } = await supabase.from('transactions').select('id',{count:'exact',head:true}).or(`buyer_entity_id.in.(${entIds.join(',')}),supplier_entity_id.in.(${entIds.join(',')})`);
  console.log(`Zostava napojenych na Rapavy: ${rest}`);
  if ((rest||0) === 0) {
    const { error: e3 } = await supabase.from('entities').delete().in('id', entIds);
    console.log(e3 ? ('ERR delete entities: '+e3.message) : `Zmazane duplicitne entity Rapavy Peter: ${entIds.length}`);
  }
  console.log('HOTOVO.');
}
run().catch(e => console.log('FATAL: ' + e.message));
