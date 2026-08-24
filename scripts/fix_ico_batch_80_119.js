// FIX nazvy entit podla RPO (davka 80-119). Dry-run default, --apply zapise.
// Oba pary overene RPO api.statistics.sk (presna zhoda identifiers[].value, aktualny fullName).
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const APPLY = process.argv.includes('--apply');
const FIXES = [
  // [ico, to_name, dovod]
  ['35706767', 'ASSA SCAFFOLDING s. r. o.', 'RPO: 35706767 od 2024-08-01 = ASSA SCAFFOLDING s.r.o. (predtym ASSA profi); DB mala len "SCAFFOLDING s.r.o."'],
  ['35872799', 'OMD Consulting, s. r. o.', 'RPO: 35872799 od 2015 = OMD Consulting, s.r.o.; DB "M&D CONSULTING" je zle (preklep, iny subjekt neexistuje)'],
];
(async () => {
  for (const [ico, toName, dovod] of FIXES) {
    const { data, error } = await supabase.from('entities').select('id,name').eq('ico', ico);
    if (error || !data || !data.length) { console.log(`SKIP ${ico}: nenajdene`, error?.message); continue; }
    console.log(`${ico}: "${data[0].name}" -> "${toName}" | ${dovod}`);
    if (!APPLY) { console.log('DRY-RUN'); continue; }
    const { error: up } = await supabase.from('entities').update({ name: toName }).eq('id', data[0].id);
    console.log(up ? `FAIL ${ico}: ${up.message}` : `APPLIED ${ico}`);
  }
})();
