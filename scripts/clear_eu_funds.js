require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Vyprázdni tabuľku eu_funds. Dôvod: pôvodný sync_eurofondy.js FABRIKOVAL dáta
// (náhodné sumy cez Math.random, hardcoded neexistujúce IČO). Transparentnostný
// web NESMIE zobrazovať vymyslené dotácie -> radšej prázdny modul než klamstvo.
//
// Default režim je DRY-RUN (len vypíše, čo by zmazal). Reálne mazanie až s flagom --apply.

async function run() {
  const apply = process.argv.includes('--apply');

  console.log('🧹 clear_eu_funds — čistenie fabrikovaných eurofondových dát');
  console.log(`   Režim: ${apply ? 'APPLY (reálne mazanie)' : 'DRY-RUN (nič sa nezmaže)'}`);

  // Najprv načítaj aktuálny obsah tabuľky
  const { data: rows, error: selErr } = await supabase
    .from('eu_funds')
    .select('*');

  if (selErr) {
    console.error('❌ Chyba pri čítaní eu_funds:', selErr.message);
    process.exit(1);
  }

  console.log(`   V tabuľke eu_funds je aktuálne ${rows.length} riadkov:`);
  for (const r of rows) {
    console.log(`     - id=${r.id} | ${r.project_name} | ${r.amount_eur} EUR | IČO=${r.winner_ico}`);
  }

  if (rows.length === 0) {
    console.log('✅ Tabuľka je už prázdna. Niet čo mazať.');
    return;
  }

  if (!apply) {
    console.log('ℹ️  DRY-RUN: horeuvedené riadky by boli zmazané. Spusti s --apply na vykonanie.');
    return;
  }

  // Reálne mazanie všetkých riadkov (id je UUID -> filter "id nie je null"
  // pokryje všetky riadky; Supabase vyžaduje pri delete aspoň jeden filter)
  const { error: delErr } = await supabase
    .from('eu_funds')
    .delete()
    .not('id', 'is', null);

  if (delErr) {
    console.error('❌ Chyba pri mazaní eu_funds:', delErr.message);
    process.exit(1);
  }

  // Over, že tabuľka je naozaj prázdna
  const { data: after, error: afterErr } = await supabase
    .from('eu_funds')
    .select('id');

  if (afterErr) {
    console.error('❌ Chyba pri overovaní:', afterErr.message);
    process.exit(1);
  }

  console.log(`✅ Zmazané. Tabuľka eu_funds teraz obsahuje ${after.length} riadkov.`);
}

run();
