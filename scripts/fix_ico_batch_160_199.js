// FIX: zlé IČO v entitách (dávka 160-199), overené CRZ detail + RPO. Idempotentný.
// Dry-run default; --apply pre zápis.
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const APPLY = process.argv.includes('--apply');

// [entity_id, db_name, stare_ico, nove_ico, novy_nazov] — CRZ zmluva uvádza nové IČO priamo, RPO potvrdzuje názov
const FIXES = [
  // crz 8237329: Dodávateľ "Adfex, a.s." IČO 46715894; RPO: Adifex, a. s. (36798087 neexistuje nikde)
  ['a8ab1cab-fc3b-498a-a107-554fd0999b03', 'Adfex, a.s.', '36798087', '46715894', 'Adifex, a.s.'],
  // crz 8243448: Andrej Puškár - kamenárstvo IČO 40739767; RPO: Andrej Puškár-kamenárstvo
  ['e281130f-e6a6-4f5c-bd8c-26b9792aa4fd', 'Andrej Puškár - kamenárstvo', '43841121', '40739767', 'Andrej Puškár-kamenárstvo'],
  // crz 11104429: Blue Butterfly Desing international, s.r.o IČO 51036002; RPO: Blue Butterfly Design international s.r.o.
  ['a8e9a232-de9f-4052-9f5a-2682804d466f', 'Blue Butterfly Desing international, s.r.o', '44331452', '51036002', 'Blue Butterfly Design international s.r.o.'],
];
// [ico, stary_nazov, novy_nazov] — len názov podľa RPO+ORSR
const NAME_FIXES = [
  ['44553412', 'Slovenské elektrárne, s.r.o.', 'Slovenské elektrárne – energetické služby, s.r.o.'],
];

(async () => {
  const newIcos = FIXES.map(f => f[3]);
  const { data: existing } = await supabase.from('entities').select('id,name,ico').in('ico', newIcos);
  for (const f of FIXES) {
    const [id, name, oldIco, newIco, newName] = f;
    const dup = (existing || []).find(e => e.ico === newIco && e.id !== id);
    if (dup) { console.log(`SKIP ${oldIco}->${newIco}: cielove ICO uz ma entita ${dup.id} (${dup.name}) — treba MERGE, nevykonavam.`); continue; }
    const { data: cur } = await supabase.from('entities').select('id,name,ico').eq('id', id).single();
    if (!cur || cur.ico !== oldIco) { console.log(`SKIP ${oldIco}: aktualny stav ${JSON.stringify(cur)} nezodpoveda ocakavaniu (uz opravene?).`); continue; }
    console.log(`${APPLY ? 'APPLY' : 'DRY'} entity "${cur.name}" (${oldIco}) -> IČO ${newIco}, nazov "${newName}"`);
    if (APPLY) {
      const { error } = await supabase.from('entities').update({ ico: newIco, name: newName }).eq('id', id);
      if (error) console.log('  ERROR:', error.message);
      else console.log('  OK');
    }
  }
  for (const f of NAME_FIXES) {
    const [ico, oldName, newName] = f;
    const { data: cur } = await supabase.from('entities').select('id,name,ico').eq('ico', ico).single();
    if (!cur || cur.name !== oldName) { console.log(`SKIP name ${ico}: aktualny stav ${JSON.stringify(cur)} nezodpoveda ocakavaniu.`); continue; }
    console.log(`${APPLY ? 'APPLY' : 'DRY'} entity ${ico} nazov "${oldName}" -> "${newName}"`);
    if (APPLY) {
      const { error } = await supabase.from('entities').update({ name: newName }).eq('id', cur.id);
      if (error) console.log('  ERROR:', error.message);
      else console.log('  OK');
    }
  }
})();
