// FIX: názov entity 36403008 na aktuálny RPO názov (od 2019). Idempotentný, dry-run default.
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const APPLY = process.argv.includes('--apply');
(async () => {
  const { data: cur } = await supabase.from('entities').select('id,name,ico').eq('ico', '36403008').single();
  if (!cur) { console.log('SKIP: entita 36403008 nenájdená'); return; }
  if (cur.name === 'Stredoslovenská energetika Holding, a.s.') { console.log('SKIP: už opravené'); return; }
  console.log(`${APPLY ? 'APPLY' : 'DRY'} "${cur.name}" -> "Stredoslovenská energetika Holding, a.s."`);
  if (APPLY) {
    const { error } = await supabase.from('entities').update({ name: 'Stredoslovenská energetika Holding, a.s.' }).eq('id', cur.id);
    console.log(error ? 'ERROR: ' + error.message : 'OK');
  }
})();
