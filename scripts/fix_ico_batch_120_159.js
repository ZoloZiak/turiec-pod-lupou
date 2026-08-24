// FIX: zlé IČO v entitách (dávka 120-159), overené RPO + CRZ. Idempotentný.
// Dry-run default; --apply pre zápis.
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const APPLY = process.argv.includes('--apply');

// [entity_id, db_name, stare_ico, nove_ico] — CRZ zmluva uvádza nové IČO priamo, RPO potvrdzuje názov
const FIXES = [
  ['e6fc9e05-9612-404e-8d38-9eab79b9530b', 'POH, s.r.o. "registrovaný sociálny podnik"', '36399124', '52713725'],
  ['74e9276f-0b83-43db-a9d1-a70dacd3dc6c', 'DOPSTAV obchodná a stavebná spoločnosť s.r.o.', '36399728', '36394947'],
  ['969abe99-42c8-4d0a-a844-c8e524482f68', 'GOLDY 1, s.r.o.', '36437141', '50769103'],
];
// [entity_id, stary_nazov, novy_nazov] — RPO aktuálny názov od 2019
const NAME_FIXES = [
  ['ico:36403008', null, null], // placeholder handled below via lookup
];

(async () => {
  // kontrola, či cieľové IČO už v DB existuje (duplicita guard)
  const newIcos = FIXES.map(f => f[3]);
  const { data: existing } = await supabase.from('entities').select('id,name,ico').in('ico', newIcos);
  for (const f of FIXES) {
    const [id, name, oldIco, newIco] = f;
    const dup = (existing || []).find(e => e.ico === newIco && e.id !== id);
    if (dup) { console.log(`SKIP ${oldIco}->${newIco}: cielove ICO uz ma entita ${dup.id} (${dup.name}) — treba MERGE, nevykonavam.`); continue; }
    const { data: cur } = await supabase.from('entities').select('id,name,ico').eq('id', id).single();
    if (!cur || cur.ico !== oldIco) { console.log(`SKIP ${oldIco}: aktualny stav ${JSON.stringify(cur)} nezodpoveda ocakavaniu (uz opravene?).`); continue; }
    console.log(`${APPLY ? 'APPLY' : 'DRY'} entity ${cur.name} (${oldIco}) -> IČO ${newIco}`);
    if (APPLY) {
      const { error } = await supabase.from('entities').update({ ico: newIco }).eq('id', id);
      if (error) console.log('  ERROR:', error.message);
      else console.log('  OK');
    }
  }
})();
