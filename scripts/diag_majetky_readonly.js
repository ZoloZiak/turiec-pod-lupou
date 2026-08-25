// T09: read-only overenie tabulky asset_declarations.
// Cyklus 1 odstranil HARDCODED vymysleny majetok menovanej osoby (primator Martina)
// pod falosnym 'Certifikat NRSR'. Overujeme ze DB je STALE prazdna/cestna a ze scraper
// (Krtko) medzitym nevlozil fabrikat. READ-ONLY (ziadny zapis).
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { count, error } = await supabase
    .from('asset_declarations')
    .select('*', { count: 'exact', head: true });
  if (error) {
    console.log('asset_declarations: ERR ' + error.message);
    return;
  }
  console.log('asset_declarations COUNT = ' + count);
  if (count > 0) {
    const { data, error: e2 } = await supabase
      .from('asset_declarations')
      .select('*')
      .limit(200);
    if (!e2 && data) {
      console.log('--- rows (menovane osoby / majetok / salary / source) ---');
      for (const r of data) console.log(JSON.stringify(r));
    }
  } else {
    console.log('OK: tabulka prazdna, UI zobrazi cestny prazdny stav + disclaimer.');
  }
}
main().catch(e => { console.error('FATAL', e.message); process.exit(1); });
