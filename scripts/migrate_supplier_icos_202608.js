const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

/**
 * Migrácia zámenených dodávateľských IČO — audit 2026-08 (icos-bulk).
 * 20 párov 2-zdrojovo overených (RPO ŠÚ SR + RÚZ), 5 z nich navyše spot-check parentom.
 * Spusti bez argumentu = DRY-RUN (nič nemení, vypíše plán + stav DB).
 * Spusti s --apply = vykoná zmeny.
 *
 * Stratégia sa určuje AUTOMATICKY z reálneho stavu DB:
 *  RENUMBER   – cieľové IČO v DB neexistuje → oprav ico+name na starej entite.
 *  MERGE      – cieľové IČO už existuje a je to TEN ISTÝ subjekt → presuň zmluvy, zmaž starú.
 *  FREE+RENUM – cieľové IČO obsadené CUDZÍM subjektom → cudziemu daj NO_ICO placeholder, potom prečísluj.
 */
const APPLY = process.argv.includes('--apply');

// staré IČO (v DB) -> {ico: správne, name: overený názov}
const SWAPS = [
  { bad: '36412856', good: '35900067', name: 'APV ELEKTRO spol. s r.o.' },
  { bad: '36413283', good: '47760265', name: 'Artspect spol. s r.o.' },
  { bad: '46682228', good: '46391070', name: 'Beťkoprojekt, s.r.o.' },
  { bad: '52494951', good: '43869653', name: 'DOMINANT AUDIT s.r.o.' },
  { bad: '52870197', good: '52846059', name: 'Fond na podporu športu' },
  { bad: '48154181', good: '53576390', name: 'GTR-glass s.r.o.' },
  { bad: '00317021', good: '00647209', name: 'Mesto Vrútky' },
  { bad: '87110170', good: '53995031', name: 'Adam Ďurica' },
  { bad: '50417931', good: '52351785', name: 'BD Pltníky, s.r.o.' },
  { bad: '47990799', good: '48105252', name: 'fine arch s.r.o.' },
  { bad: '00000604', good: '00151742', name: 'Ministerstvo financií Slovenskej republiky' },
  { bad: '00164623', good: '00164615', name: 'Národné osvetové centrum' },
  { bad: '47021672', good: '46352562', name: 'NARKO s.r.o.' },
  { bad: '00216822', good: '00316822', name: 'Obec Nolčovo' },
  { bad: '50250689', good: '50659669', name: 'PREMIUM Insurance Company Limited, pobočka poisťovne z iného členského štátu' },
  { bad: '00000868', good: '00151866', name: 'Ministerstvo vnútra Slovenskej republiky' },
  { bad: '53127594', good: '53584244', name: 'Sociálny podnik mesta Martin, s. r. o.' },
  { bad: '31749504', good: '31749542', name: 'Štátny fond rozvoja bývania' },
  { bad: '36423086', good: '44802030', name: 'TuCon, a.s.' },
  { bad: '31813811', good: '31819494', name: 'Výskumná agentúra' },
];

async function ent(ico) {
  const { data } = await supabase.from('entities').select('id, name, ico, type').eq('ico', ico).maybeSingle();
  return data;
}
async function txCount(id) {
  const b = await supabase.from('transactions').select('id', { count: 'exact', head: true }).eq('buyer_entity_id', id);
  const s = await supabase.from('transactions').select('id', { count: 'exact', head: true }).eq('supplier_entity_id', id);
  return (b.count || 0) + (s.count || 0);
}
async function moveTx(fromId, toId) {
  const a = await supabase.from('transactions').update({ buyer_entity_id: toId }).eq('buyer_entity_id', fromId);
  const b = await supabase.from('transactions').update({ supplier_entity_id: toId }).eq('supplier_entity_id', fromId);
  if (a.error) throw a.error; if (b.error) throw b.error;
}

// heuristika "ten istý subjekt" pre MERGE (bezpečné: len ak sa významovo prekrývajú)
function sameSubject(a, b) {
  const norm = s => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[",.\-]/g, ' ').replace(/\b(s r o|a s|sro|as|spol)\b/g, ' ').replace(/\s+/g, ' ').trim();
  const na = norm(a), nb = norm(b);
  if (!na || !nb) return false;
  const wa = na.split(' ').filter(w => w.length >= 4);
  return wa.some(w => nb.includes(w));
}

async function processSwap(s) {
  const o = await ent(s.bad);
  if (!o) { console.log(`  SKIP ${s.bad}→${s.good} "${s.name}": stará entita s IČO ${s.bad} v DB neexistuje`); return; }
  const oTx = await txCount(o.id);
  const target = await ent(s.good);

  if (!target) {
    console.log(`  RENUMBER ${s.bad}(${o.id}, ${oTx} zml.)→${s.good} "${s.name}" [type=${o.type}]`);
    if (APPLY) {
      const r = await supabase.from('entities').update({ ico: s.good, name: s.name, normalized_name: s.name.toLowerCase() }).eq('id', o.id);
      if (r.error) throw r.error;
      console.log('    ✓ ico+name opravené na entite');
    }
    return;
  }
  // cieľ existuje
  if (sameSubject(o.name, target.name) || sameSubject(s.name, target.name)) {
    console.log(`  MERGE ${s.bad}(${o.id}, ${oTx} zml.)→${s.good}(${target.id}, "${target.name}") "${s.name}"`);
    if (APPLY) {
      await moveTx(o.id, target.id);
      await supabase.from('entities').update({ name: s.name, normalized_name: s.name.toLowerCase() }).eq('id', target.id);
      await supabase.from('entities').delete().eq('id', o.id);
      console.log('    ✓ zmluvy presunuté, cieľ opravený, stará zmazaná');
    }
  } else {
    const placeholder = 'NO_ICO_' + (target.name || 'UNKNOWN').replace(/[^a-zA-Z0-9]/g, '').substring(0, 15).toUpperCase();
    console.log(`  FREE+RENUM ${s.good} obsadené CUDZÍM "${target.name}"(${target.id}) → ${placeholder}; potom ${s.bad}→${s.good}`);
    if (APPLY) {
      await supabase.from('entities').update({ ico: placeholder }).eq('id', target.id);
      const r = await supabase.from('entities').update({ ico: s.good, name: s.name, normalized_name: s.name.toLowerCase() }).eq('id', o.id);
      if (r.error) throw r.error;
      console.log('    ✓ cudzí subjekt na placeholder (zmluvy ponechané), stará entita prečíslovaná');
    }
  }
}

async function run() {
  console.log('='.repeat(64));
  console.log(APPLY ? '🔧 MIGRÁCIA DODÁVATEĽSKÝCH IČO — APPLY' : '👀 MIGRÁCIA DODÁVATEĽSKÝCH IČO — DRY-RUN (nič sa nemení)');
  console.log('='.repeat(64) + '\n');
  for (const s of SWAPS) {
    try { await processSwap(s); } catch (e) { console.error(`  CHYBA pri ${s.bad}→${s.good}: ${e.message}`); }
  }
  console.log('\n' + (APPLY ? '✅ Migrácia dokončená.' : 'ℹ️  DRY-RUN. Skontroluj plán, potom spusti s --apply.'));
}
run().catch(e => { console.error('CHYBA:', e.message); process.exit(1); });
