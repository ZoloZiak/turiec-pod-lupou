// WATCH #86 READ-ONLY diag: preveruje ci external_id z seedu este existuju v transactions
// a ci ich AKTUALNE id zodpoveda related_transaction_ids v promises.
require('dotenv').config({ path: '.env.local' });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const SEED = {
  'Bezplatná MHD': ['crz_10259786','crz_8709893','crz_7303370'],
  'Oprava ciest a chodníkov': ['crz_12520464','crz_12393408','crz_10638558','crz_11009331','crz_11026426'],
  'Výstavba domovov pre seniorov': ['crz_8771290','crz_8952321','crz_10003078','crz_10550719'],
  'Zelenšie mesto a údržba parkov': ['crz_10557230','crz_12290562','crz_12616353','crz_11824864'],
  'Lanovka na Martinské hole': ['crz_12714918','crz_12409465','crz_12712246'],
  'Nové parkovacie miesta': ['crz_10241953','crz_9220008','crz_12731606'],
  'Parkovacia politika (Parkovacie domy)': ['crz_10979509','crz_9223868','crz_12731606'],
  'Výstavba Univerzitnej nemocnice': ['crz_10434350','crz_10516440','crz_11874251','crz_12602252'],
};

async function run() {
  // 1) test .in() query mechanics: fetch one known promise's id list and one tx by id
  const { data: promises } = await supabase
    .from('promises').select('title,related_transaction_ids');
  const sample = promises.find(p => (p.related_transaction_ids||[]).length);
  const sampleId = sample.related_transaction_ids[0];
  const { data: byId, error: e1 } = await supabase
    .from('transactions').select('id,external_id').eq('id', sampleId);
  console.log(`[.eq id test] promise "${sample.title}" first linked id=${sampleId}`);
  console.log(`  -> found by id: ${byId && byId.length ? byId[0].external_id : 'NONE'} ${e1?('ERR '+e1.message):''}`);

  // 2) resolve each seed external_id to its CURRENT id in transactions
  const allExt = [...new Set(Object.values(SEED).flat())];
  const extToRow = {};
  for (let i=0;i<allExt.length;i+=100){
    const chunk = allExt.slice(i,i+100);
    const { data } = await supabase.from('transactions')
      .select('id,external_id,description,amount_eur,supplier_name,customer_name,date').in('external_id', chunk);
    for (const t of (data||[])) extToRow[t.external_id]=t;
  }
  console.log(`\n[external_id resolve] ${allExt.length} unikatnych seed external_id:`);
  for (const [title, exts] of Object.entries(SEED)) {
    const linkedIds = new Set((promises.find(p=>p.title===title)?.related_transaction_ids)||[]);
    console.log(`\n=== ${title}`);
    for (const ext of exts) {
      const t = extToRow[ext];
      if (!t) { console.log(`  ${ext}: NEEXISTUJE v transactions`); continue; }
      const match = linkedIds.has(t.id) ? 'ID-MATCH' : 'ID-MISMATCH(link stale)';
      console.log(`  ${ext}: cur_id=${t.id} [${match}] ${(Number(t.amount_eur)||0).toFixed(2)}EUR | ${t.supplier_name} | obj:${t.customer_name} | ${t.date}`);
      console.log(`     ${(t.description||'').slice(0,110)}`);
    }
  }
}
run().catch(e=>console.log('FATAL',e.message));
