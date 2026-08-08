// scripts/clear_asset_declarations.js
// NOČNÝ AUDIT: tabuľka asset_declarations obsahovala HARDCODED vymyslené dáta
// o menovanej osobe (primátor Martina) pod falošným 'Certifikát dát z NRSR'.
// Tento skript vyprázdni tabuľku. Dry-run default; --apply reálne zmaže.
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const APPLY = process.argv.includes('--apply');

async function main() {
  const { data: rows, error: selErr } = await supabase
    .from('asset_declarations')
    .select('*');

  if (selErr) {
    console.error('CHYBA pri čítaní asset_declarations:', selErr.message);
    process.exit(1);
  }

  console.log(`Nájdených riadkov v asset_declarations: ${rows.length}`);
  rows.forEach((r) => {
    console.log(`  - ${r.person_name} | ${r.role} | ${r.year} | ${r.official_salary_eur}€ | ${r.declared_assets}`);
  });

  if (!APPLY) {
    console.log('\n[DRY-RUN] Nič sa nezmazalo. Pre reálne zmazanie spusti s --apply.');
    return;
  }

  console.log('\n[APPLY] Mažem všetky riadky asset_declarations...');
  // delete všetkých riadkov (podmienka vždy pravdivá: id nie je null)
  const { error: delErr } = await supabase
    .from('asset_declarations')
    .delete()
    .not('id', 'is', null);

  if (delErr) {
    console.error('CHYBA pri mazaní:', delErr.message);
    process.exit(1);
  }

  const { data: after, error: afterErr } = await supabase
    .from('asset_declarations')
    .select('*');

  if (afterErr) {
    console.error('CHYBA pri overovaní:', afterErr.message);
    process.exit(1);
  }

  console.log(`Hotovo. Riadkov po zmazaní: ${after.length}`);
  if (after.length !== 0) {
    console.error('VAROVANIE: tabuľka NIE JE prázdna!');
    process.exit(1);
  }
  console.log('Tabuľka asset_declarations je prázdna.');
}

main();
