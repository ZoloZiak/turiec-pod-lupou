const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

/**
 * Zámenené dodávateľské IČO, kde IČO PREUKÁZATEĽNE patrí inému subjektu
 * (oba registre RÚZ+RPO zhodné na cudzom mene) a správne IČO dodávateľa NEPOZNÁME.
 * Bezpečné riešenie = presunúť entitu na NO_ICO_ placeholder: tým sa z webu SKRYJÚ
 * klamlivé odkazy (ORSR/RPVS/FinStat na cudzí subjekt), zmluvy sa ZACHOVAJÚ.
 * NIKDY nehádžeme správne IČO. Zdroj: .audit/deep_audit_analysis.md.
 * Dry-run default; --apply vykoná. Idempotentné (už-placeholder preskočí).
 */
const APPLY = process.argv.includes('--apply');

// len dokázané zámeny (oba registre = cudzí subjekt), NIE neisté/false-positive
const BAD_ICOS = [
  '46800883', // ALAM → Halama Invest
  '44735588', // architekton → ateliér 4A
  '35756764', // AT a.s. → B.O.A.T.
  '52202330', // COREX → ENCOREX/Recent
  '36374377', // CREAT → BRAINY CREATIVE
  '55476911', // EBA → este kačka
  '51870827', // G a T → G a T STK
  '43897452', // GV → GASTRO VRÁBEĽ
  '35553588', // KROS → ZUŠ Košice
  '51285606', // Luan → PALUAN
  '55616895', // MIP → MIRMIP
  '53229649', // MUNIPOLIS → AE Drones (CZ firma)
  '36530506', // NOVOCASING → Food Factory
  '44122250', // RECOM → FibreComponents
  '46448764', // RS-Building → DAUGAVA
  '36577847', // Rstav → TORSTAV
  '53395646', // Servis a.s. → Servis-PRO
  '56118236', // SWAN → Dataswans
  '45022623', // VERE → partnerstvo Južný Gemer
];

function placeholder(name) {
  return 'NO_ICO_' + (name || 'UNKNOWN').replace(/[^a-zA-Z0-9]/g, '').substring(0, 15).toUpperCase();
}

(async () => {
  console.log(APPLY ? '🔧 APPLY' : '👀 DRY-RUN', `— ${BAD_ICOS.length} zámenených IČO na NO_ICO placeholder:`);
  let changed = 0;
  for (const ico of BAD_ICOS) {
    const { data: e } = await supabase.from('entities').select('id, name, ico').eq('ico', ico).maybeSingle();
    if (!e) { console.log(`  ${ico}: v DB nie je — SKIP`); continue; }
    const ph = placeholder(e.name);
    console.log(`  ${ico} "${e.name}" → ${ph}`);
    if (!APPLY) continue;
    const { error } = await supabase.from('entities').update({ ico: ph }).eq('id', e.id);
    if (error) console.error(`    chyba:`, error.message); else changed++;
  }
  console.log(APPLY ? `✅ Zmenených ${changed}. Zmluvy zachované, klamlivé odkazy skryté.` : '\nSpusti s --apply.');
})();
