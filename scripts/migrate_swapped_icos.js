const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

/**
 * Migrácia zámenených IČO (audit 2026-08) — explicitná stratégia per subjekt,
 * odvodená z reálneho stavu produkčnej DB (viď dry-run diagnostiku).
 * Spusti s --apply; bez neho DRY-RUN.
 *
 * Overené dvoma registrami (RÚZ + RPO ŠÚ SR). Stratégie:
 *  MERGE      – cieľ je ten istý subjekt (duplicita) → presuň zmluvy, zmaž starú.
 *  RENUMBER   – cieľ neexistuje → oprav ico na starej entite.
 *  FREE+RENUM – cieľové ico obsadené CUDZÍM subjektom (chybný scrape) →
 *               cudziemu daj NO_ICO placeholder, potom prečísluj starú entitu.
 */
const APPLY = process.argv.includes('--apply');

async function ent(ico) {
  const { data } = await supabase.from('entities').select('id, name, ico, type').eq('ico', ico).maybeSingle();
  return data;
}
async function moveTx(fromId, toId) {
  const a = await supabase.from('transactions').update({ buyer_entity_id: toId }).eq('buyer_entity_id', fromId);
  const b = await supabase.from('transactions').update({ supplier_entity_id: toId }).eq('supplier_entity_id', fromId);
  if (a.error) throw a.error; if (b.error) throw b.error;
}

async function merge(badIco, goodIco, name, type) {
  const o = await ent(badIco), n = await ent(goodIco);
  if (!o) { console.log(`  MERGE ${badIco}→${goodIco}: stará neexistuje, preskakujem`); return; }
  if (!n) return renumber(badIco, goodIco, name, type);
  console.log(`  MERGE ${badIco}(${o.id})→${goodIco}(${n.id}) "${name}"`);
  if (!APPLY) return;
  await moveTx(o.id, n.id);
  await supabase.from('entities').update({ name, type, normalized_name: name.toLowerCase() }).eq('id', n.id);
  await supabase.from('entities').delete().eq('id', o.id);
  console.log('    ✓ zmluvy presunuté, cieľ opravený, stará zmazaná');
}

async function renumber(badIco, goodIco, name, type) {
  const o = await ent(badIco);
  if (!o) { console.log(`  RENUMBER ${badIco}→${goodIco}: stará neexistuje, preskakujem`); return; }
  console.log(`  RENUMBER ${badIco}(${o.id})→${goodIco} "${name}"`);
  if (!APPLY) return;
  await supabase.from('entities').update({ ico: goodIco, name, type, normalized_name: name.toLowerCase() }).eq('id', o.id);
  console.log('    ✓ ico opravené na entite');
}

async function freeAndRenumber(badIco, goodIco, name, type) {
  const o = await ent(badIco), squatter = await ent(goodIco);
  if (squatter) {
    const placeholder = 'NO_ICO_' + (squatter.name || 'UNKNOWN').replace(/[^a-zA-Z0-9]/g, '').substring(0, 15).toUpperCase();
    console.log(`  FREE   ${goodIco} obsadené "${squatter.name}"(${squatter.id}) → ${placeholder}`);
    if (APPLY) {
      await supabase.from('entities').update({ ico: placeholder }).eq('id', squatter.id);
      console.log('    ✓ cudzí subjekt presunutý na placeholder (zmluvy ponechané)');
    }
  }
  await renumber(badIco, goodIco, name, type);
}

async function run() {
  console.log('='.repeat(60));
  console.log(APPLY ? '🔧 MIGRÁCIA IČO — APPLY' : '👀 MIGRÁCIA IČO — DRY-RUN');
  console.log('='.repeat(60));

  console.log('\n▶ Mesto Martin');
  await merge('00316741', '00316792', 'Mesto Martin', 'MUNICIPALITY');

  console.log('\n▶ Turčianska vodárenská spoločnosť (cieľ obsadený)');
  await freeAndRenumber('36402691', '36672084', 'Turčianska vodárenská spoločnosť, a.s.', 'MUNICIPALITY');

  console.log('\n▶ Sociálny podnik mesta Martin');
  await merge('52402126', '53584244', 'Sociálny podnik mesta Martin, s. r. o.', 'MUNICIPALITY');

  console.log('\n▶ Správa športových zariadení mesta Martin');
  await renumber('37905185', '37806939', 'Správa športových zariadení mesta Martin', 'MUNICIPALITY');

  console.log('\n▶ Kultúrna scéna MARTIN');
  await renumber('53560795', '42386497', 'Kultúrna scéna MARTIN', 'MUNICIPALITY');

  console.log('\n' + (APPLY ? '✅ Migrácia dokončená.' : 'ℹ️  DRY-RUN. Spusti s --apply.'));
}
run().catch(e => { console.error('CHYBA:', e.message); process.exit(1); });
