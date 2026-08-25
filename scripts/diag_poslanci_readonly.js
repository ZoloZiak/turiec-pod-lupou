// T08: read-only overenie tabulky city_council_votes.
// Cyklus 1 odstranil fabrikovane mena/hlasovania (Ing. Jan Kovac, MUDr. Peter Novak...).
// Overujeme ze DB je STALE prazdna/cestna a ze scraper (Krtko) medzitym nevlozil fabrikat.
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { count, error } = await supabase
    .from('city_council_votes')
    .select('*', { count: 'exact', head: true });
  if (error) {
    console.log('city_council_votes: ERR ' + error.message);
    return;
  }
  console.log('city_council_votes COUNT = ' + count);
  if (count > 0) {
    const { data, error: e2 } = await supabase
      .from('city_council_votes')
      .select('*')
      .limit(100);
    if (!e2 && data) {
      console.log('--- rows (menovane osoby / hlasovania) ---');
      for (const r of data) console.log(JSON.stringify(r));
    }
  } else {
    console.log('OK: tabulka prazdna, UI zobrazi cestny prazdny stav.');
  }
}
main().catch(e => { console.error('FATAL', e.message); process.exit(1); });
