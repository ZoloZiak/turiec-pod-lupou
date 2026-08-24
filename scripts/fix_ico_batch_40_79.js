// FIX entities IČO podľa CRZ+RPO (dávka 40-79). Dry-run default, --apply zapíše.
// Opravy overené 2 zdrojmi: RPO (api.statistics.sk) + CRZ detail zmluvy.
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const APPLY = process.argv.includes('--apply');
const FIXES = [
  // [entity_id, from_ico, to_ico, to_name, dovod]
  ['cebea986-1e60-4714-b1de-f2fbc6b4b408', '10734180', '36842176', 'KATSUDO s. r. o.', 'CRZ 7951850 uvadza ICO 36842176; RPO potvrzuje KATSUDO s.r.o., Presov'],
  ['e28d7c5a-0acc-499c-a770-f6641c42ecc6', '31385915', '31322832', 'SLOVNAFT, a.s.', 'CRZ 10638877/12238823 uvadza ICO 31322832; RPO: 31385915=SLOVNAFT TRANS a.s. (zly subjekt)'],
  ['47653b01-bff6-4863-9f41-c989564ee924', '31386563', '00365327', 'Univerzitná nemocnica Martin', 'RPO: 31386563=UN AGEL Milosrdni bratia BA (zly subjekt); UNM Martin ma ICO 00365327 (RPO+CRZ)'],
];
(async () => {
  for (const [id, fromIco, toIco, toName] of FIXES) {
    const { data: clash } = await supabase.from('entities').select('id,name').eq('ico', toIco);
    if (clash && clash.length) { console.log(`SKIP ${fromIco}->${toIco}: cielove ICO uz existuje`, clash); continue; }
    if (!APPLY) { console.log(`DRY-RUN ${fromIco} -> ${toIco} (${toName})`); continue; }
    const { error } = await supabase.from('entities').update({ ico: toIco, name: toName }).eq('id', id).eq('ico', fromIco);
    console.log(error ? `FAIL ${toIco}: ${error.message}` : `APPLIED ${fromIco} -> ${toIco}`);
  }
})();
